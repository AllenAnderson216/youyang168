import { json } from './_lib/util.js';
import { memberSecret, normalizePhone, hashCode, createMemberCookie, maskPhone } from './_lib/member.js';

const MAX_ATTEMPTS = 5;

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: '请求格式错误' }, 400); }

  const phone = normalizePhone(body.phone);
  const code = String(body.code || '').trim();
  if (!phone) return json({ error: '请输入正确的 11 位手机号' }, 400);
  if (!/^\d{6}$/.test(code)) return json({ error: '请输入 6 位数字验证码' }, 400);
  if (body.agree !== true) return json({ error: '请先阅读并同意隐私政策' }, 400);

  const secret = memberSecret(env);
  if (!secret) return json({ error: '会员系统暂未配置' }, 503);

  const row = await env.DB.prepare(
    `SELECT * FROM sms_codes WHERE phone = ? AND used = 0 ORDER BY created_at DESC LIMIT 1`
  ).bind(phone).first();
  if (!row || row.expires_at < Date.now()) {
    return json({ error: '验证码已过期或不存在，请重新获取' }, 400);
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return json({ error: '验证码错误次数过多，请重新获取' }, 429);
  }

  const expected = await hashCode(secret, phone, code);
  if (expected !== row.code_hash) {
    await env.DB.prepare(`UPDATE sms_codes SET attempts = attempts + 1 WHERE id = ?`).bind(row.id).run();
    return json({ error: '验证码错误' }, 400);
  }

  // 验证码只能用一次；用 used=0 作条件，防止并发重放
  const claim = await env.DB.prepare(
    `UPDATE sms_codes SET used = 1 WHERE id = ? AND used = 0`
  ).bind(row.id).run();
  if (!claim.meta || claim.meta.changes !== 1) {
    return json({ error: '验证码已使用，请重新获取' }, 400);
  }

  const existing = await env.DB.prepare(`SELECT id FROM users WHERE phone = ?`).bind(phone).first();
  const isNew = !existing;
  if (isNew) {
    await env.DB.prepare(`INSERT OR IGNORE INTO users (phone, last_login_at) VALUES (?, datetime('now'))`).bind(phone).run();
  } else {
    await env.DB.prepare(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`).bind(existing.id).run();
  }
  const user = await env.DB.prepare(`SELECT id FROM users WHERE phone = ?`).bind(phone).first();

  const cookie = await createMemberCookie(secret, user.id);
  return json({ ok: true, isNew, phone: maskPhone(phone) }, 200, { 'set-cookie': cookie, 'cache-control': 'no-store' });
}
