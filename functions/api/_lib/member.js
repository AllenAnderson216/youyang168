import { hmacSha256Hex, sha256Hex } from './pem.js';

const COOKIE_NAME = 'yh_member';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 天

// 会员登录态签名密钥：优先用独立的 MEMBER_SESSION_SECRET，没有则从后台密钥派生一个不同的密钥，
// 保证会员 Cookie 永远不能当后台 Cookie 用。
export function memberSecret(env) {
  if (env.MEMBER_SESSION_SECRET) return env.MEMBER_SESSION_SECRET;
  if (env.ADMIN_SESSION_SECRET) return env.ADMIN_SESSION_SECRET + '|member-v1';
  return '';
}

export function getIp(request) {
  return request.headers.get('CF-Connecting-IP') || '';
}

// 只接受 11 位大陆手机号；兼容用户输入 +86 / 86 前缀、空格、横线
export function normalizePhone(input) {
  let s = String(input || '').replace(/[\s-]/g, '');
  if (s.startsWith('+86')) s = s.slice(3);
  else if (s.length === 13 && s.startsWith('86')) s = s.slice(2);
  return /^1[3-9]\d{9}$/.test(s) ? s : null;
}

export function maskPhone(phone) {
  return phone ? phone.slice(0, 3) + '****' + phone.slice(-4) : '';
}

export function generateCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return String(n).padStart(6, '0');
}

export function hashCode(secret, phone, code) {
  return sha256Hex(`${secret}|${phone}|${code}`);
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createMemberCookie(secret, userId) {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `${userId}.${expires}`;
  const sig = await hmacSha256Hex(secret, payload);
  return `${COOKIE_NAME}=${payload}.${sig}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE_SECONDS}`;
}

export function clearMemberCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function readCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  const match = header.split(';').map(s => s.trim()).find(s => s.startsWith(name + '='));
  return match ? match.slice(name.length + 1) : null;
}

// 返回已登录会员的 id；未登录或 Cookie 无效返回 null
export async function getMemberId(request, env) {
  const secret = memberSecret(env);
  if (!secret) return null;
  const raw = readCookie(request, COOKIE_NAME);
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 3) return null;
  const [uid, expires, sig] = parts;
  const expected = await hmacSha256Hex(secret, `${uid}.${expires}`);
  if (!safeEqual(expected, sig)) return null;
  if (!Number.isFinite(Number(expires)) || Date.now() > Number(expires)) return null;
  const id = Number(uid);
  return Number.isInteger(id) && id > 0 ? id : null;
}
