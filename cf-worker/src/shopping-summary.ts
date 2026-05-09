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

export const SHOPPING_SUMMARY_SYSTEM_PROMPT = `Ti si asistent za kupovinu hrane. Korisnik ti šalje agregiranu listu sastojaka iz nedeljnog plana ishrane. Tvoj zadatak je da pretvoriš tu listu u praktičnu listu za kupovinu.

PRAVILA:

1) SPAJANJE DUPLIKATA I VARIJANTI
- Spoji ako je očigledno isti proizvod: "Sir" + "Beli sir" → "Beli sir"; "Pileće belo meso" + "Pileći file" → "Pileći file"
- NE spajaj ako su različiti proizvodi: "Hleb" + "Integralni hleb" (ostavi razdvojeno); razne vrste paradajza/paprike/luka (cherry vs običan, beli vs crni luk) ostavi razdvojeno
- Spoji istu stavku u različitim jedinicama (g i kom, ml i L) u jednu logičnu mernu jedinicu

2) NORMALIZACIJA JEDINICA
- Tečnosti (mleko, ulje, jogurt): ml ili L
- Voće/povrće: kom ako su mali brojevi, g ako su veliki količinski
- Meso: g ili kg
- Brašno, žitarice, šećer, riža: g ili kg
- Začini: g ili kašičica/kašika
- Ako se različite jedinice ne mogu pouzdano kombinovati, izaberi dominantnu i napomeni razliku u "note"

3) KUPOVNA KOLIČINA
- ZAOKRUŽI NAVIŠE do realne ambalaže/pakovanja (npr. mleko 350 ml → 0.5 L; jaja 4 kom → 6 ili 10 kom; brašno 230 g → 500 g)
- Ako je preporučeno više od izračunatog, dodaj kratku napomenu u "note" (npr. "iz plana ~340 ml" ili "≈3 srednja paradajza")
- Začini koji se koriste u malim količinama: napomeni "kupi pakovanje ako nemaš"

4) GRUPISANJE
- Kategorije: meat, dairy, produce, grain, pantry, spice, oil
- Koristi ISTU kategoriju kao u ulaznom sastojku osim ako je očigledna greška

5) MAPIRANJE KLJUČEVA
- "sourceKeys" je niz "key" vrednosti iz ulaza koji su spojeni u ovu izlaznu stavku
- SVAKI ulazni "key" se MORA pojaviti tačno jednom kroz ceo izlaz (bez duplikata, bez izostavljanja)

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

export function buildShoppingSummaryPrompt(items: ShoppingSummaryInputItem[]): string {
  const lines = items.map((i) => {
    const qty = i.quantity == null ? '?' : i.quantity;
    const variants =
      i.variants && i.variants.length > 1 ? ` | varijante: ${i.variants.join(', ')}` : '';
    return `- key="${i.key}" | ${i.name} ${qty} ${i.unit} [${i.category}]${variants}`;
  });
  return `Sumarizuj sledeću agregiranu listu sastojaka u praktičnu listu za kupovinu. Ulaz (${items.length} stavki):\n\n${lines.join('\n')}`;
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
          temperature: 0.3,
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
  return JSON.parse(text) as ShoppingSummaryResponse;
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
        temperature: 0.3,
        max_tokens: 4000,
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
  return JSON.parse(text) as ShoppingSummaryResponse;
}
