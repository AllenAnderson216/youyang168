import { json } from './_lib/util.js';
import { sendVerifyCodeSms } from './_lib/aliyun-sms.js';
import { memberSecret, getIp, normalizePhone, generateCode, hashCode } from './_lib/member.js';

const COOLDOWN_MS = 60 * 1000;          // 同一手机号 60 秒内只能发一次
const CODE_TTL_MS = 5 * 60 * 1000;      // 验证码 5 分钟有效
const PER_PHONE_PER_HOUR = 5;           // 同一手机号每小时最多 5 条
const PER_IP_PER_HOUR = 20;             // 同一 IP 每小时最多 20 条
const DEFAULT_DAILY_LIMIT = 300;        // 全站每天最多发送条数（保护短信套餐，可用 SMS_DAILY_LIMIT 调整）

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: '请求格式错误' }, 400); }

  const phone = normalizePhone(body.phone);
  if (!phone) return json({ error: '请输入正确的 11 位手机号' }, 400);

  if (!env.ALIYUN_ACCESS_KEY_ID || !env.ALIYUN_ACCESS_KEY_SECRET || !env.ALIYUN_SMS_SIGN_NAME || !env.ALIYUN_SMS_TEMPLATE_CODE) {
    return json({ error: '短信服务暂未配置' }, 503);
  }
  const secret = memberSecret(env);
  if (!secret) return json({ error: '会员系统暂未配置' }, 503);

  const now = Date.now();
  const ip = getIp(request);

  const last = await env.DB.prepare(
    `SELECT created_at FROM sms_codes WHERE phone = ? ORDER BY created_at DESC LIMIT 1`
  ).bind(phone).first();
  if (last && now - last.created_at < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - (now - last.created_at)) / 1000);
    return json({ error: `发送太频繁，请 ${wait} 秒后再试` }, 429);
  }

  const hourAgo = now - 3600 * 1000;
  const phoneCount = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM sms_codes WHERE phone = ? AND created_at > ?`
  ).bind(phone, hourAgo).first();
  if (phoneCount && phoneCount.c >= PER_PHONE_PER_HOUR) {
    return json({ error: '该手机号获取验证码过于频繁，请 1 小时后再试' }, 429);
  }

  if (ip) {
    const ipCount = await env.DB.prepare(
      `SELECT COUNT(*) AS c FROM sms_codes WHERE ip = ? AND created_at > ?`
    ).bind(ip, hourAgo).first();
    if (ipCount && ipCount.c >= PER_IP_PER_HOUR) {
      return json({ error: '操作过于频繁，请稍后再试' }, 429);
    }
  }

  const dailyLimit = Number(env.SMS_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;
  const dayCount = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM sms_codes WHERE created_at > ?`
  ).bind(now - 24 * 3600 * 1000).first();
  if (dayCount && dayCount.c >= dailyLimit) {
    return json({ error: '今日验证码发送量已达上限，请明天再试' }, 429);
  }

  const code = generateCode();
  const codeHash = await hashCode(secret, phone, code);
  const ins = await env.DB.prepare(
    `INSERT INTO sms_codes (phone, code_hash, ip, created_at, expires_at) VALUES (?, ?, ?, ?, ?)`
  ).bind(phone, codeHash, ip, now, now + CODE_TTL_MS).run();
  const rowId = ins.meta && ins.meta.last_row_id;

  try {
    await sendVerifyCodeSms(env, { phone, code });
  } catch (e) {
    console.log('短信发送失败:', e.message);
    // 发送失败的记录删掉，不占用该手机号的频率额度
    if (rowId) await env.DB.prepare(`DELETE FROM sms_codes WHERE id = ?`).bind(rowId).run();
    const out = { error: '短信发送失败，请稍后重试' };
    if (env.SMS_DEBUG === '1') out.detail = e.message;
    return json(out, 400);
  }

  return json({ ok: true, cooldown: COOLDOWN_MS / 1000 });
}
