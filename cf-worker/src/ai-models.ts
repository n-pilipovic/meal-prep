/**
 * Single source of truth for AI model selection.
 *
 * To change a model permanently → edit a constant below and redeploy.
 * To change without redeploy → set GEMINI_MODEL / GROQ_MODEL in wrangler.toml [vars]
 * or via `wrangler secret put GEMINI_MODEL` (secret takes precedence over [vars]).
 */

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite';
export const DEFAULT_GROQ_MODEL = 'llama-3.1-8b-instant';

/** Per-provider request timeout. Cloudflare Worker request budget is ~30s,
 *  so we keep each call under 15s to leave room for the fallback provider. */
export const AI_REQUEST_TIMEOUT_MS = 15_000;

export interface ModelEnv {
  GEMINI_MODEL?: string;
  GROQ_MODEL?: string;
}

export function resolveGeminiModel(env: ModelEnv): string {
  return env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export function resolveGroqModel(env: ModelEnv): string {
  return env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
}

/**
 * fetch() that aborts after AI_REQUEST_TIMEOUT_MS and reports the timeout
 * with a labeled provider name (used by the Gemini→Groq fallback in index.ts).
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  providerLabel: string,
  timeoutMs: number = AI_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`${providerLabel} timeout after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
