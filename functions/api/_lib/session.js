import { hmacSha256Hex } from './pem.js';

const COOKIE_NAME = 'yh_admin';
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8小时

export async function createSessionCookie(secret) {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = String(expires);
  const sig = await hmacSha256Hex(secret, payload);
  const value = `${payload}.${sig}`;
  return `${COOKIE_NAME}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE_SECONDS}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

function readCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  const match = header.split(';').map(s => s.trim()).find(s => s.startsWith(name + '='));
  if (!match) return null;
  return match.slice(name.length + 1);
}

export async function verifySession(request, secret) {
  const raw = readCookie(request, COOKIE_NAME);
  if (!raw) return false;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return false;
  const expected = await hmacSha256Hex(secret, payload);
  if (expected !== sig) return false;
  const expires = Number(payload);
  if (!Number.isFinite(expires) || Date.now() > expires) return false;
  return true;
}
