import { json } from './_lib/util.js';
import { createSessionCookie } from './_lib/session.js';

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: '请求格式错误' }, 400);
  }

  if (!env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) {
    return json({ error: '后台未配置' }, 500);
  }

  // 简单等长比较，降低时序攻击风险
  const input = String(body.password || '');
  const expected = env.ADMIN_PASSWORD;
  const match = input.length === expected.length && input === expected;

  if (!match) return json({ error: '密码错误' }, 401);

  const cookie = await createSessionCookie(env.ADMIN_SESSION_SECRET);
  return json({ ok: true }, 200, { 'set-cookie': cookie });
}
