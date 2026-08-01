import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sendPushNotification } from './web-push';

/**
 * Exercises the real WebCrypto path end to end. `encryptPayload` is not
 * exported, so it is driven through `sendPushNotification` with `fetch` stubbed
 * — which also pins the wire contract the client depends on.
 */

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** workers-types returns `ArrayBuffer | JsonWebKey` from exportKey; tests know which. */
const rawKey = async (key: CryptoKey) =>
  new Uint8Array((await crypto.subtle.exportKey('raw', key)) as ArrayBuffer);

const jwkOf = async (key: CryptoKey) =>
  (await crypto.subtle.exportKey('jwk', key)) as JsonWebKey;

const fromB64url = (s: string) =>
  Uint8Array.from(
    atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')),
    (c) => c.charCodeAt(0),
  );

/** A subscriber keypair, the way a browser would hand one to us. */
async function makeSubscription() {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair;

  const raw = await rawKey(pair.publicKey);
  const auth = crypto.getRandomValues(new Uint8Array(16));

  return {
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
    keys: { p256dh: b64url(raw), auth: b64url(auth) },
  };
}

/** VAPID signing key in the raw 32-byte form the worker expects. */
async function makeVapidKeys() {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;

  const jwk = await jwkOf(pair.privateKey);
  const pub = await rawKey(pair.publicKey);

  return { publicKey: b64url(pub), privateKey: jwk.d! };
}

const NOTIFICATION = {
  title: 'Ručak za 30 min (13:00)',
  body: '☐ Pasulj 90g\n☐ Pastrmka 150g',
  tag: 'meal-rucak',
  data: { url: '/meal-prep/today' },
};

describe('sendPushNotification', () => {
  let calls: { url: string; init: RequestInit }[];

  beforeEach(() => {
    calls = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response('', { status: 201 });
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('encrypts and posts a notification', async () => {
    const sub = await makeSubscription();
    const vapid = await makeVapidKeys();

    const ok = await sendPushNotification(sub, NOTIFICATION, vapid, 'mailto:x@y.z');

    expect(ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(sub.endpoint);
  });

  it('sends aes128gcm with a non-empty encrypted body', async () => {
    const sub = await makeSubscription();
    const vapid = await makeVapidKeys();

    await sendPushNotification(sub, NOTIFICATION, vapid, 'mailto:x@y.z');

    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['Content-Encoding']).toBe('aes128gcm');
    expect(headers['TTL']).toBe('86400');
    expect(headers['Authorization']).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);

    const body = calls[0].init.body as Uint8Array;
    // 21-byte aes128gcm header (salt + rs + idlen + key) + ciphertext + GCM tag
    expect(body.byteLength).toBeGreaterThan(21 + 16);
    expect(Number(headers['Content-Length'])).toBe(body.byteLength);
  });

  it('does not leak the plaintext into the body', async () => {
    const sub = await makeSubscription();
    const vapid = await makeVapidKeys();

    await sendPushNotification(sub, NOTIFICATION, vapid, 'mailto:x@y.z');

    const body = new TextDecoder().decode(calls[0].init.body as Uint8Array);
    expect(body).not.toContain('Ručak');
    expect(body).not.toContain('notification');
  });

  it('produces a different ciphertext each call (fresh ephemeral key + salt)', async () => {
    const sub = await makeSubscription();
    const vapid = await makeVapidKeys();

    await sendPushNotification(sub, NOTIFICATION, vapid, 'mailto:x@y.z');
    await sendPushNotification(sub, NOTIFICATION, vapid, 'mailto:x@y.z');

    const [a, b] = calls.map(c => new Uint8Array(c.init.body as Uint8Array));
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  // Regression: privateKeyToPkcs8 used to emit a truncated ASN.1 structure, so
  // importKey threw, the whole send was swallowed by the catch, and no push was
  // ever delivered. A token that verifies proves the key imported correctly.
  it('signs a VAPID token that verifies against the public key', async () => {
    const sub = await makeSubscription();
    const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify',
    ])) as CryptoKeyPair;
    const jwk = await jwkOf(pair.privateKey);
    const pubRaw = await rawKey(pair.publicKey);

    await sendPushNotification(
      sub,
      NOTIFICATION,
      { publicKey: b64url(pubRaw), privateKey: jwk.d! },
      'mailto:x@y.z',
    );

    const auth = (calls[0].init.headers as Record<string, string>)['Authorization'];
    const [, token, sentKey] = auth.match(/^vapid t=([^,]+), k=(.+)$/)!;
    const [headerB64, payloadB64, sigB64] = token.split('.');

    const verified = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pair.publicKey,
      fromB64url(sigB64),
      new TextEncoder().encode(`${headerB64}.${payloadB64}`),
    );
    expect(verified).toBe(true);

    expect(sentKey).toBe(b64url(pubRaw));
    expect(JSON.parse(new TextDecoder().decode(fromB64url(headerB64)))).toEqual({
      typ: 'JWT',
      alg: 'ES256',
    });

    const claims = JSON.parse(new TextDecoder().decode(fromB64url(payloadB64)));
    expect(claims.aud).toBe('https://fcm.googleapis.com');
    expect(claims.sub).toBe('mailto:x@y.z');
    expect(claims.exp).toBeGreaterThan(Date.now() / 1000);
  });

  it('reports failure instead of throwing when the push service rejects', async () => {
    vi.stubGlobal('fetch', async () => new Response('gone', { status: 410 }));
    const sub = await makeSubscription();
    const vapid = await makeVapidKeys();

    await expect(sendPushNotification(sub, NOTIFICATION, vapid, 'mailto:x@y.z')).resolves.toBe(
      false,
    );
  });

  it('reports failure instead of throwing on a malformed subscription key', async () => {
    const vapid = await makeVapidKeys();
    const broken = { endpoint: 'https://push.example/x', keys: { p256dh: 'not-a-key', auth: 'aa' } };

    await expect(sendPushNotification(broken, NOTIFICATION, vapid, 'mailto:x@y.z')).resolves.toBe(
      false,
    );
  });
});
