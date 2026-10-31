// Single-user session: an HMAC of the app password in an httpOnly cookie.
// Uses Web Crypto so it also runs in middleware (edge runtime).
export const SESSION_COOKIE = "mc_session";

async function hmac(secret: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sessionToken(): Promise<string> {
  const pw = process.env.APP_PASSWORD;
  const secret = process.env.ENCRYPTION_KEY;
  if (!pw || !secret) throw new Error("APP_PASSWORD and ENCRYPTION_KEY must be set");
  // Domain-separated from the AES key derivation (sha256(key)) used for token encryption.
  return hmac("mc-session-v1:" + secret, pw);
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    return safeEqual(token, await sessionToken());
  } catch {
    return false;
  }
}
