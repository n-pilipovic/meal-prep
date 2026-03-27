/**
 * Web Push implementation for Cloudflare Workers using the Web Crypto API.
 * Implements the VAPID (Voluntary Application Server Identification) protocol.
 */

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

/**
 * Send a push notification to a subscriber.
 */
export async function sendPushNotification(
  subscription: PushSubscription,
  payload: { title: string; body: string; icon?: string; tag?: string; data?: unknown },
  vapidKeys: VapidKeys,
  vapidSubject: string,
): Promise<boolean> {
  try {
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));

    // Encrypt the payload using the subscription's keys
    const encrypted = await encryptPayload(
      payloadBytes,
      subscription.keys.p256dh,
      subscription.keys.auth,
    );

    // Create VAPID JWT token
    const endpoint = new URL(subscription.endpoint);
    const audience = `${endpoint.protocol}//${endpoint.host}`;
    const vapidToken = await createVapidToken(audience, vapidSubject, vapidKeys);

    // Send to push service
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'Content-Length': encrypted.body.byteLength.toString(),
        TTL: '86400',
        Authorization: `vapid t=${vapidToken.token}, k=${vapidToken.publicKey}`,
      },
      body: encrypted.body,
    });

    if (response.status === 201 || response.status === 200) {
      return true;
    }

    console.error(`Push failed: ${response.status} ${await response.text()}`);
    return false;
  } catch (err) {
    console.error('Push notification error:', err);
    return false;
  }
}

async function createVapidToken(
  audience: string,
  subject: string,
  keys: VapidKeys,
): Promise<{ token: string; publicKey: string }> {
  const now = Math.floor(Date.now() / 1000);
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: subject,
  };

  const headerB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const privateKeyBytes = base64urlDecode(keys.privateKey);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyToPkcs8(privateKeyBytes),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(unsignedToken),
  );

  // Convert DER signature to raw (r || s)
  const rawSig = derToRaw(new Uint8Array(signature));
  const signatureB64 = base64urlEncode(rawSig);

  return {
    token: `${unsignedToken}.${signatureB64}`,
    publicKey: keys.publicKey,
  };
}

/**
 * Encrypt payload using the subscriber's public key and auth secret.
 * Uses aes128gcm content encoding as per RFC 8291.
 */
async function encryptPayload(
  payload: Uint8Array,
  p256dhKey: string,
  authSecret: string,
): Promise<{ body: Uint8Array }> {
  const clientPublicKey = base64urlDecode(p256dhKey);
  const clientAuth = base64urlDecode(authSecret);

  // Generate ephemeral ECDH key pair
  const serverKeys = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  );

  // Import client's public key
  const clientKey = await crypto.subtle.importKey(
    'raw',
    clientPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  // Derive shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientKey },
    serverKeys.privateKey,
    256,
  );

  // Export server public key
  const serverPublicKeyRaw = await crypto.subtle.exportKey('raw', serverKeys.publicKey);
  const serverPublicKeyBytes = new Uint8Array(serverPublicKeyRaw);

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Derive encryption key and nonce using HKDF
  const authInfo = concatBytes(
    new TextEncoder().encode('WebPush: info\0'),
    clientPublicKey,
    serverPublicKeyBytes,
  );

  const ikm = await hkdf(
    new Uint8Array(clientAuth),
    new Uint8Array(sharedSecret),
    authInfo,
    32,
  );

  const contentEncKeyInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0');
  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0');

  const prk = await hkdf(salt, ikm, new Uint8Array(0), 32);
  const contentEncKey = await hkdf(salt, ikm, contentEncKeyInfo, 16);
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);

  // Add padding delimiter
  const paddedPayload = concatBytes(payload, new Uint8Array([2]));

  // Encrypt with AES-128-GCM
  const key = await crypto.subtle.importKey(
    'raw',
    contentEncKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    paddedPayload,
  );

  // Build aes128gcm header: salt (16) + rs (4) + idlen (1) + keyid (65)
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);

  const header = concatBytes(
    salt,
    rs,
    new Uint8Array([serverPublicKeyBytes.length]),
    serverPublicKeyBytes,
  );

  return { body: concatBytes(header, new Uint8Array(encrypted)) };
}

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const prk = await crypto.subtle.sign('HMAC', key, salt.length > 0 ? salt : new Uint8Array(32));

  const prkKey = await crypto.subtle.importKey(
    'raw',
    prk,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const infoWithCounter = concatBytes(info, new Uint8Array([1]));
  const okm = await crypto.subtle.sign('HMAC', prkKey, infoWithCounter);

  return new Uint8Array(okm).slice(0, length);
}

function privateKeyToPkcs8(rawKey: Uint8Array): ArrayBuffer {
  // Wrap raw 32-byte EC private key in PKCS#8 ASN.1 structure for P-256
  const pkcs8Header = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
    0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02,
    0x01, 0x01, 0x04, 0x20,
  ]);
  const pkcs8Footer = new Uint8Array([
    0xa1, 0x44, 0x03, 0x42, 0x00,
  ]);

  return concatBytes(pkcs8Header, rawKey, pkcs8Footer).buffer;
}

function derToRaw(der: Uint8Array): Uint8Array {
  // If it's already 64 bytes, it's raw format
  if (der.length === 64) return der;

  // Parse DER SEQUENCE of two INTEGERs
  const raw = new Uint8Array(64);
  let offset = 2; // skip SEQUENCE tag and length

  // R value
  const rLen = der[offset + 1];
  offset += 2;
  const rStart = rLen > 32 ? offset + (rLen - 32) : offset;
  const rDest = rLen < 32 ? 32 - rLen : 0;
  raw.set(der.slice(rStart, offset + rLen), rDest);
  offset += rLen;

  // S value
  const sLen = der[offset + 1];
  offset += 2;
  const sStart = sLen > 32 ? offset + (sLen - 32) : offset;
  const sDest = sLen < 32 ? 64 - sLen : 32;
  raw.set(der.slice(sStart, offset + sLen), sDest);

  return raw;
}

function base64urlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}
