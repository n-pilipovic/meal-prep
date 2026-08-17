import { describe, it, expect, vi } from 'vitest';
import {
  sanitizeDishMetas,
  refineCookPlanCached,
  buildCookPlanPrompt,
  type DishRefineInput,
  type DishMeta,
} from './cook-plan';
import type { KVNamespace } from './kv-helpers';

function makeKv(seed: Record<string, unknown> = {}): KVNamespace & { store: Map<string, string> } {
  const store = new Map<string, string>();
  for (const [k, v] of Object.entries(seed)) store.set(k, JSON.stringify(v));
  return {
    store,
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list({ prefix }: { prefix?: string } = {}) {
      return {
        keys: [...store.keys()]
          .filter(k => !prefix || k.startsWith(prefix))
          .map(name => ({ name })),
      };
    },
  };
}

const INPUTS: DishRefineInput[] = [
  { key: 'gulas sa piletinom', name: 'Gulaš sa piletinom', ingredients: ['Piletina', 'Luk'] },
  { key: 'jogurt sa vocem', name: 'Jogurt sa voćem', ingredients: ['Jogurt', 'Banana'] },
];

function meta(key: string, overrides: Partial<DishMeta> = {}): DishMeta {
  return { key, needsCooking: true, keepsDays: 3, prepAhead: [], ...overrides };
}

describe('sanitizeDishMetas', () => {
  it('keeps only valid input keys, once each', () => {
    const out = sanitizeDishMetas(
      {
        dishes: [
          meta('gulas sa piletinom'),
          meta('gulas sa piletinom'), // duplicate
          meta('izmisljeno jelo'), // not in the input
        ],
      },
      INPUTS,
    );
    expect(out.map(d => d.key)).toEqual(['gulas sa piletinom']);
  });

  it('clamps keepsDays to 1–7 and defaults malformed values to 3', () => {
    const out = sanitizeDishMetas(
      {
        dishes: [
          meta('gulas sa piletinom', { keepsDays: 40 }),
          meta('jogurt sa vocem', { keepsDays: 'sutra' as unknown as number }),
        ],
      },
      INPUTS,
    );
    expect(out[0].keepsDays).toBe(7);
    expect(out[1].keepsDays).toBe(3);
  });

  it('filters non-string prep steps and caps them at 4', () => {
    const out = sanitizeDishMetas(
      {
        dishes: [
          meta('gulas sa piletinom', {
            prepAhead: ['Iseckaj luk', 42, '', 'a', 'b', 'c', 'd'] as unknown as string[],
          }),
        ],
      },
      INPUTS,
    );
    expect(out[0].prepAhead).toEqual(['Iseckaj luk', 'a', 'b', 'c']);
  });

  it('treats anything but literal true as not-cooking', () => {
    const out = sanitizeDishMetas(
      { dishes: [meta('gulas sa piletinom', { needsCooking: 'yes' as unknown as boolean })] },
      INPUTS,
    );
    expect(out[0].needsCooking).toBe(false);
  });

  it('returns empty array for garbage payloads', () => {
    expect(sanitizeDishMetas(null, INPUTS)).toEqual([]);
    expect(sanitizeDishMetas({ dishes: 'x' }, INPUTS)).toEqual([]);
  });
});

describe('refineCookPlanCached', () => {
  it('serves everything from cache without calling the provider', async () => {
    const kv = makeKv({
      'dishmeta:v1:gulas sa piletinom': meta('gulas sa piletinom'),
      'dishmeta:v1:jogurt sa vocem': meta('jogurt sa vocem', { needsCooking: false, keepsDays: 1 }),
    });
    const provider = vi.fn();

    const result = await refineCookPlanCached(kv, INPUTS, provider);

    expect(provider).not.toHaveBeenCalled();
    expect(result.dishes).toHaveLength(2);
    expect(result.incomplete).toBeUndefined();
  });

  it('asks the provider only for uncached dishes and caches the answers', async () => {
    const kv = makeKv({
      'dishmeta:v1:gulas sa piletinom': meta('gulas sa piletinom'),
    });
    const provider = vi.fn(async (uncached: DishRefineInput[]) =>
      uncached.map(d => meta(d.key, { needsCooking: false, keepsDays: 1 })),
    );

    const result = await refineCookPlanCached(kv, INPUTS, provider);

    expect(provider).toHaveBeenCalledOnce();
    expect(provider.mock.calls[0][0].map((d: DishRefineInput) => d.key)).toEqual([
      'jogurt sa vocem',
    ]);
    expect(result.dishes).toHaveLength(2);
    expect(kv.store.has('dishmeta:v1:jogurt sa vocem')).toBe(true);
  });

  it('returns cached subset with incomplete flag when the provider fails', async () => {
    const kv = makeKv({
      'dishmeta:v1:gulas sa piletinom': meta('gulas sa piletinom'),
    });
    const provider = vi.fn(async () => {
      throw new Error('provider down');
    });

    const result = await refineCookPlanCached(kv, INPUTS, provider);

    expect(result.dishes.map(d => d.key)).toEqual(['gulas sa piletinom']);
    expect(result.incomplete).toBe(true);
  });

  it('rethrows when the provider fails and nothing is cached', async () => {
    const kv = makeKv();
    const provider = vi.fn(async () => {
      throw new Error('provider down');
    });

    await expect(refineCookPlanCached(kv, INPUTS, provider)).rejects.toThrow('provider down');
  });
});

describe('buildCookPlanPrompt', () => {
  it('emits one compact line per dish', () => {
    const prompt = buildCookPlanPrompt(INPUTS);
    expect(prompt).toContain('gulas sa piletinom|Gulaš sa piletinom|Piletina, Luk|');
    expect(prompt.split('\n').filter(l => l.includes('|'))).toHaveLength(3); // header mentions format too
  });
});
