/**
 * Optional archive encryption using the platform WebCrypto implementation (AES-256-GCM,
 * key from PBKDF2-SHA-256). No custom cryptography. Layout: MAGIC | salt(16) | iv(12) | ciphertext.
 */
const MAGIC = new TextEncoder().encode('TMENC1');
export const PBKDF2_ITERATIONS = 600_000;

export function cryptoAvailable(): boolean {
  return typeof globalThis.crypto?.subtle?.importKey === 'function';
}

export function isEncrypted(bytes: Uint8Array): boolean {
  return bytes.length > MAGIC.length && MAGIC.every((b, i) => bytes[i] === b);
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encrypt(plain: Uint8Array, passphrase: string, iterations = PBKDF2_ITERATIONS): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, iterations);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain as BufferSource));
  const out = new Uint8Array(MAGIC.length + 4 + salt.length + iv.length + cipher.length);
  out.set(MAGIC, 0);
  new DataView(out.buffer).setUint32(MAGIC.length, iterations);
  out.set(salt, MAGIC.length + 4);
  out.set(iv, MAGIC.length + 4 + 16);
  out.set(cipher, MAGIC.length + 4 + 28);
  return out;
}

export class WrongPassphraseError extends Error {
  constructor() {
    super('Mật khẩu không đúng hoặc tệp đã bị hỏng');
    this.name = 'WrongPassphraseError';
  }
}

export async function decrypt(data: Uint8Array, passphrase: string): Promise<Uint8Array> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const iterations = view.getUint32(MAGIC.length);
  const salt = data.slice(MAGIC.length + 4, MAGIC.length + 20);
  const iv = data.slice(MAGIC.length + 20, MAGIC.length + 32);
  const key = await deriveKey(passphrase, salt, iterations);
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data.slice(MAGIC.length + 32)));
  } catch {
    throw new WrongPassphraseError();
  }
}
