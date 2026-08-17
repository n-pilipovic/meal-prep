import { fetchWithTimeout } from './ai-models';
import { getJSON, putJSON, type KVNamespace } from './kv-helpers';

export interface DishRefineInput {
  /** Client-side normalized dish key — also the KV cache key suffix. */
  key: string;
  name: string;
  description?: string;
  ingredients: string[];
}

export interface DishMeta {
  key: string;
  needsCooking: boolean;
  /** How many days the cooked dish keeps in the fridge (1–7). */
  keepsDays: number;
  /** Short Serbian imperative steps doable the evening before (no actual cooking). */
  prepAhead: string[];
}

export interface CookPlanRefineResponse {
  dishes: DishMeta[];
  /** True when the AI provider failed and only cached entries could be served. */
  incomplete?: boolean;
}

/** Bump to invalidate every cached dish classification after a prompt change. */
const CACHE_VERSION = 'v1';
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

export const MAX_REFINE_DISHES = 100;

export const COOK_PLAN_SYSTEM_PROMPT = `Ti si kuvar-planer za "meal prep" (kuvanje unapred za više dana). Korisnik ti šalje listu jela iz nedeljnog plana ishrane. Za SVAKO jelo proceni:

1) "needsCooking" — da li jelo zahteva termičku obradu (kuvanje, pečenje, prženje, dinstanje)?
- true: gulaš, čorba, pečena piletina, kuvani pasulj, ruska salata (kuva se povrće)...
- false: jogurt sa voćem, sendvič, sveža salata, ovsena kaša preko noći, voće, namaz koji se samo razmaže...

2) "keepsDays" — koliko dana SKUVANO jelo ostaje bezbedno i ukusno u frižideru (ceo broj 1–7)?
- Sveže salate i jela sa svežim mlečnim prelivima: 1
- Riba i morski plodovi: 1–2
- Piletina, ćuretina, mleveno meso: 3
- Variva, gulaši, čorbe: 3–4
- Ako jelo ne zahteva kuvanje, stavi 1.

3) "prepAhead" — 0 do 4 KRATKA koraka pripreme koji se mogu obaviti veče PRE kuvanja: pranje, ljuštenje, seckanje, mariniranje, potapanje (pasulj!). NIKAD koraci koji su samo termička obrada ili sklapanje jela. Svaki korak u imperativu, na srpskom (latinica), maksimalno 8 reči, sa konkretnim sastojkom (npr. "Iseckaj luk i papriku", "Potopi pasulj u vodu", "Mariniraj piletinu"). Ako nema smislene pripreme unapred, vrati prazan niz.

PRAVILA IZLAZA:
- Odgovori ISKLJUČIVO validnim JSON-om: {"dishes":[{"key":"...","needsCooking":true,"keepsDays":3,"prepAhead":["..."]}]}
- SVAKI ulazni "key" mora se pojaviti TAČNO JEDNOM u izlazu, nepromenjen.
- Bez dodatnog teksta, bez markdown ograda.`;

export function buildCookPlanPrompt(dishes: DishRefineInput[]): string {
  // Compact one-line-per-dish format: key|name|ingredients|description
  const lines = dishes.map(d => {
    const ingredients = d.ingredients.slice(0, 12).join(', ');
    const description = (d.description ?? '').slice(0, 120);
    return `${d.key}|${d.name}|${ingredients}|${description}`;
  });
  return `Klasifikuj sledeća jela (${dishes.length}). Format ulaza: key|ime|sastojci|opis.\n\n${lines.join('\n')}`;
}

/**
 * Validate and clamp model output; anything malformed is dropped so the
 * client falls back to its own heuristics for that dish.
 */
export function sanitizeDishMetas(raw: unknown, inputs: DishRefineInput[]): DishMeta[] {
  const dishes = Array.isArray((raw as any)?.dishes) ? (raw as any).dishes : [];
  const validKeys = new Set(inputs.map(d => d.key));
  const seen = new Set<string>();
  const out: DishMeta[] = [];

  for (const item of dishes) {
    const key = typeof item?.key === 'string' ? item.key : '';
    if (!validKeys.has(key) || seen.has(key)) continue;
    seen.add(key);

    const keepsRaw = typeof item.keepsDays === 'number' ? Math.round(item.keepsDays) : 3;
    const prepAhead = Array.isArray(item.prepAhead)
      ? item.prepAhead
          .filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0)
          .map((s: string) => s.trim().slice(0, 80))
          .slice(0, 4)
      : [];

    out.push({
      key,
      needsCooking: item.needsCooking === true,
      keepsDays: Math.min(7, Math.max(1, keepsRaw)),
      prepAhead,
    });
  }
  return out;
}

export async function refineCookPlanGemini(
  apiKey: string,
  dishes: DishRefineInput[],
  model: string,
): Promise<DishMeta[]> {
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: COOK_PLAN_SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: buildCookPlanPrompt(dishes) }] }],
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
  return sanitizeDishMetas(JSON.parse(text), dishes);
}

export async function refineCookPlanGroq(
  apiKey: string,
  dishes: DishRefineInput[],
  model: string,
): Promise<DishMeta[]> {
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
          { role: 'system', content: COOK_PLAN_SYSTEM_PROMPT },
          { role: 'user', content: buildCookPlanPrompt(dishes) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 3000,
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
  return sanitizeDishMetas(JSON.parse(text), dishes);
}

function cacheKey(dishKey: string): string {
  return `dishmeta:${CACHE_VERSION}:${dishKey}`;
}

/**
 * Serve dish classifications from KV where possible and ask the AI only for
 * the rest — dish names repeat week after week, so most requests after the
 * first are fully cached and never touch a provider.
 */
export async function refineCookPlanCached(
  kv: KVNamespace,
  dishes: DishRefineInput[],
  callProvider: (uncached: DishRefineInput[]) => Promise<DishMeta[]>,
): Promise<CookPlanRefineResponse> {
  const cached: DishMeta[] = [];
  const uncached: DishRefineInput[] = [];

  for (const dish of dishes) {
    const hit = await getJSON<DishMeta>(kv, cacheKey(dish.key));
    if (hit) cached.push(hit);
    else uncached.push(dish);
  }

  if (uncached.length === 0) return { dishes: cached };

  let fresh: DishMeta[];
  try {
    fresh = await callProvider(uncached);
  } catch (err) {
    if (cached.length > 0) return { dishes: cached, incomplete: true };
    throw err;
  }

  for (const meta of fresh) {
    await putJSON(kv, cacheKey(meta.key), meta, { expirationTtl: CACHE_TTL_SECONDS });
  }

  return { dishes: [...cached, ...fresh] };
}
