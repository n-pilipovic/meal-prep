import { fetchWithTimeout } from './ai-models';

export interface ShoppingSummaryInputItem {
  key: string;
  name: string;
  quantity: number | null;
  unit: string;
  category: string;
  variants?: string[];
}

export interface ShoppingSummaryOutputItem {
  name: string;
  quantity: number | null;
  unit: string;
  category: string;
  note?: string;
  sourceKeys: string[];
}

export interface ShoppingSummaryGroup {
  category: string;
  items: ShoppingSummaryOutputItem[];
}

export interface ShoppingSummaryResponse {
  groups: ShoppingSummaryGroup[];
}

export const SHOPPING_SUMMARY_SYSTEM_PROMPT = `Ti si asistent za kupovinu hrane. Korisnik ti šalje agregiranu listu sastojaka iz nedeljnog plana ishrane. Tvoj zadatak je da pretvoriš tu listu u praktičnu listu za kupovinu — SAMO sirovi sastojci koji se kupuju u prodavnici, BEZ jela, recepata i pripreme.

PRAVILA:

1) ISTA STAVKA SE NIKAD NE PONAVLJA
- U FINALNOM IZLAZU svaki proizvod (logički isti sirovi sastojak) sme da se pojavi TAČNO JEDNOM, bez obzira što je u ulazu pod više različitih ključeva.
- Sve ulazne stavke koje su logički isti proizvod MORAŠ spojiti u jednu izlaznu stavku, sumiraj količine i u "sourceKeys" stavi sve ulazne ključeve.
- Primer obaveznog spajanja: ulaz ima "Pileće meso", "Pileće belo meso", "Pileći file", "Pileća pašteta", "Piletina sa senfom" → IZLAZ: jedna stavka "Pileće belo meso" sa zbirnom količinom i sourceKeys = svi navedeni ključevi.

2) SAMO SIROVI SASTOJCI — DEKOMPONUJ ILI ODBACI JELA
- Izlazno ime MORA biti sirovi sastojak iz prodavnice. NIKAD ime jela, recepta, salate, sosa ili napitka.
- Prepoznaj jela po obrascima: "X sa Y" (Piletina sa senfom, Kupus sa junetinom), "X od Y" (Sos od paradajza), "X + Y" (Pasulj + kupus), "Salata ...", "Taratur", "Pašteta", "Sendvič ...", "Čorba ...", "Sarma".
- Postupak za jelo u ulazu:
  a) Ako možeš izvući primarni sirovi sastojak → koristi ga ("Pileća pašteta" → "Pileće belo meso", "Taratur salata" → "Krastavac", "Kupus sa junetinom" → izvuci "Kupus" i "Mlevenu junetinu" ako nisu već u listi inače spoji u postojeću).
  b) Ako su sastojci jela već razdvojeno u ulazu (npr. ulaz već sadrži "Kupus" i "Mlevena junetina"), DODAJ ulazni ključ jela u sourceKeys POSTOJEĆE stavke i NEMOJ izlistati jelo zasebno.
  c) Ako nikako ne možeš dekomponovati i nije jasan sirovi sastojak → IZBACI tu ulaznu stavku iz izlaza, ali njen ključ DODAJ u sourceKeys neke logički bliske stavke (ili u sourceKeys "Razno" stavke ako baš nema).
- Ukloni iz imena: opise pripreme ("kuvano", "pečeno", "prženo", "blanširano", "narendano", "pasirano", "sveže", "dinstano"), zagrade i sve unutar njih.

3) KOLIČINE BEZ JEDINICE / NULL
- Ako je ulazna količina null ili 0, a stavka je legitiman sastojak (so, biljni začini), zadrži je sa quantity=null i napomenom "kupi pakovanje ako nemaš".
- Ako je ulazna količina null jer je u stvari jelo (Piletina sa senfom bez količine), primeni pravilo 2.

4) SPAJANJE U RAZLIČITIM JEDINICAMA
- Spoji istu stavku u različitim jedinicama (g i kom, ml i L) u jednu logičnu mernu jedinicu, sumiraj na osnovu razumne konverzije.
- Kada je konverzija nepouzdana, izaberi dominantnu jedinicu i napomeni razliku u "note".

5) PROIZVODI KOJI SE NE SPAJAJU
- "Hleb" + "Integralni hleb" → razdvojeno; razne vrste paradajza/paprike/luka (cherry vs običan, beli vs crni luk) razdvojeno; "Jogurt" + "Kiselo mleko" razdvojeno; "Mleko" + "Pavlaka" razdvojeno.

6) NORMALIZACIJA JEDINICA
- Tečnosti (mleko, ulje, jogurt): ml ili L
- Voće/povrće: kom ako su mali brojevi, g ako su veliki količinski
- Meso: g ili kg
- Brašno, žitarice, šećer, riža: g ili kg
- Začini: g ili kašičica/kašika

7) KUPOVNA KOLIČINA
- ZAOKRUŽI NAVIŠE do realne ambalaže/pakovanja (npr. mleko 350 ml → 0.5 L; jaja 4 kom → 6 ili 10 kom; brašno 230 g → 500 g)
- Ako je preporučeno više od izračunatog, dodaj kratku napomenu u "note" (npr. "iz plana ~340 ml" ili "≈3 srednja paradajza")

8) GRUPISANJE I MAPIRANJE KLJUČEVA
- Kategorije: meat, dairy, produce, grain, pantry, spice, oil
- "sourceKeys" je niz "key" vrednosti iz ulaza koji su spojeni u ovu izlaznu stavku
- SVAKI ulazni "key" mora se pojaviti TAČNO JEDNOM kroz ceo izlaz (bez duplikata, bez izostavljanja). Ovo važi i za ulazne ključeve koji su predstavljali jela — dodaj ih u sourceKeys odgovarajućeg sirovog sastojka (vidi pravilo 2).

JEZIK
- Sva imena, napomene i opisi su na SRPSKOM (latinica)

ODGOVORI ISKLJUČIVO validnim JSON-om u sledećoj strukturi:
{
  "groups": [
    {
      "category": "produce",
      "items": [
        {
          "name": "Paradajz",
          "quantity": 500,
          "unit": "g",
          "category": "produce",
          "note": "≈3 srednja",
          "sourceKeys": ["paradajz_g", "paradajz_kom"]
        }
      ]
    }
  ]
}

"note" je opciono — izostavi ga ako nije potrebno. "quantity" može biti broj ili null kada količina nije primenjiva.`;

/** Lowercase + collapse whitespace + strip diacritics for fuzzy name matching. */
function normalizeName(name: unknown): string {
  if (typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Safety net: if the model still emits two output items with the same canonical
 * name + unit (within or across categories), merge them into one. Also tolerates
 * malformed model output (missing/null name, unit, sourceKeys, etc.).
 */
export function dedupeShoppingSummary(
  summary: ShoppingSummaryResponse,
): ShoppingSummaryResponse {
  const groups = Array.isArray(summary?.groups) ? summary.groups : [];

  // Group by (normalized name, unit) — first occurrence wins for category/name/note
  const merged = new Map<string, ShoppingSummaryOutputItem>();
  for (const group of groups) {
    const items = Array.isArray(group?.items) ? group.items : [];
    for (const raw of items) {
      const name = typeof raw?.name === 'string' ? raw.name : '';
      if (!name.trim()) continue; // skip items the model failed to name
      const unit = typeof raw?.unit === 'string' ? raw.unit : '';
      const category =
        typeof raw?.category === 'string' && raw.category ? raw.category : group.category;
      const quantity = typeof raw?.quantity === 'number' ? raw.quantity : null;
      const sourceKeys = Array.isArray(raw?.sourceKeys)
        ? raw.sourceKeys.filter((k): k is string => typeof k === 'string')
        : [];
      const note = typeof raw?.note === 'string' ? raw.note : undefined;

      const dedupeKey = `${normalizeName(name)}|${unit.toLowerCase()}`;
      const existing = merged.get(dedupeKey);
      if (existing) {
        if (existing.quantity != null && quantity != null) {
          existing.quantity += quantity;
        } else if (existing.quantity == null) {
          existing.quantity = quantity;
        }
        for (const k of sourceKeys) {
          if (!existing.sourceKeys.includes(k)) existing.sourceKeys.push(k);
        }
        if (!existing.note && note) existing.note = note;
      } else {
        merged.set(dedupeKey, {
          name,
          quantity,
          unit,
          category,
          sourceKeys: [...sourceKeys],
          ...(note ? { note } : {}),
        });
      }
    }
  }

  // Re-bucket by category, preserving original group order
  const groupOrder: string[] = [];
  const byCategory = new Map<string, ShoppingSummaryOutputItem[]>();
  for (const group of groups) {
    if (typeof group?.category !== 'string') continue;
    if (!byCategory.has(group.category)) {
      groupOrder.push(group.category);
      byCategory.set(group.category, []);
    }
  }
  for (const item of merged.values()) {
    if (!byCategory.has(item.category)) {
      groupOrder.push(item.category);
      byCategory.set(item.category, []);
    }
    byCategory.get(item.category)!.push(item);
  }

  return {
    groups: groupOrder
      .map(category => ({ category, items: byCategory.get(category) ?? [] }))
      .filter(g => g.items.length > 0),
  };
}

export function buildShoppingSummaryPrompt(items: ShoppingSummaryInputItem[]): string {
  // Compact format keeps the request below Groq's per-request token cap on big plans.
  // Format: key|name qty unit category (extra variants, max 2, only if differ from name)
  const lines = items.map((i) => {
    const qty = i.quantity == null ? '?' : i.quantity;
    const extras = (i.variants ?? [])
      .filter(v => v !== i.name)
      .slice(0, 2);
    const extra = extras.length > 0 ? ` (${extras.join(', ')})` : '';
    return `${i.key}|${i.name} ${qty}${i.unit} ${i.category}${extra}`;
  });
  return `Sumarizuj agregiranu listu sastojaka u praktičnu listu za kupovinu (${items.length} stavki). Format ulaza: key|ime količinajedinica kategorija (varijante).\n\n${lines.join('\n')}`;
}

export async function summarizeShoppingListGemini(
  apiKey: string,
  items: ShoppingSummaryInputItem[],
  model: string,
): Promise<ShoppingSummaryResponse> {
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SHOPPING_SUMMARY_SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: buildShoppingSummaryPrompt(items) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      }),
    },
    'Gemini',
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${error}`);
  }

  const result = (await response.json()) as {
    candidates: { content: { parts: { text: string }[] } }[];
  };

  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');
  return dedupeShoppingSummary(JSON.parse(text) as ShoppingSummaryResponse);
}

export async function summarizeShoppingListGroq(
  apiKey: string,
  items: ShoppingSummaryInputItem[],
  model: string,
): Promise<ShoppingSummaryResponse> {
  const response = await fetchWithTimeout(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SHOPPING_SUMMARY_SYSTEM_PROMPT },
          { role: 'user', content: buildShoppingSummaryPrompt(items) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        // Output is typically <1500 tokens; 2000 keeps total under Groq's per-request cap.
        max_tokens: 2000,
      }),
    },
    'Groq',
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error ${response.status}: ${error}`);
  }

  const result = (await response.json()) as {
    choices: { message: { content: string } }[];
  };

  const text = result.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from Groq');
  return dedupeShoppingSummary(JSON.parse(text) as ShoppingSummaryResponse);
}
