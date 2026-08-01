export interface KVPutOptions {
  /** Seconds until the key self-deletes. Cloudflare's minimum is 60. */
  expirationTtl?: number;
}

export interface KVNamespace {
  get(key: string, type?: 'text'): Promise<string | null>;
  put(key: string, value: string, options?: KVPutOptions): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string }): Promise<{ keys: { name: string }[] }>;
}

export async function getJSON<T>(kv: KVNamespace, key: string): Promise<T | null> {
  const raw = await kv.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function putJSON(
  kv: KVNamespace,
  key: string,
  value: unknown,
  options?: KVPutOptions,
): Promise<void> {
  await kv.put(key, JSON.stringify(value), options);
}
