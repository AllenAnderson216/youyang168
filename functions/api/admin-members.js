import { json } from './_lib/util.js';
import { verifySession } from './_lib/session.js';

// 会员管理（仅管理员）
//   GET  /api/admin-members?q=手机号片段   → 会员列表（含每位会员的订单数）
//   POST /api/admin-members {action:'delete', userId}          → 删除单个会员
//   POST /api/admin-members {action:'clear_all', confirm:'CLEAR_ALL'} → 清空全部会员
//
// 只删除 users 表里的会员账号：
//  - 不会删除 orders / order_items（订单与会员只靠手机号关联，订单需要保留用于对账和售后）
//  - 不会删除 sms_codes（该表同时用于短信发送频率限制，清掉会让每日上限等保护失效）

async function requireAdmin(request, env) {
  const authed = await verifySession(request, env.ADMIN_SESSION_SECRET || '');
  return authed ? null : json({ error: '未登录' }, 401);
}

export async function onRequestGet({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const q = (new URL(request.url).searchParams.get('q') || '').trim().replace(/[%_]/g, '');
  const binds = [];
  let where = '';
  if (q) {
    where = ' WHERE u.phone LIKE ?';
    binds.push(`%${q}%`);
  }

  const count = await env.DB.prepare(`SELECT COUNT(*) AS total FROM users u${where}`).bind(...binds).first();
  const total = Number(count?.total || 0);
  const pageSize = 20;
  const requestedPage = Math.max(1, Number.parseInt(new URL(request.url).searchParams.get('page') || '1', 10) || 1);
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / pageSize)));

  const res = await env.DB.prepare(
    `SELECT u.id, u.phone, u.created_at, u.last_login_at,
            (SELECT COUNT(*) FROM orders o
              WHERE REPLACE(REPLACE(o.phone, ' ', ''), '-', '') IN (u.phone, '+86' || u.phone, '86' || u.phone)) AS order_count
       FROM users u${where}
      ORDER BY u.created_at DESC, u.id DESC
      LIMIT ? OFFSET ?`
  ).bind(...binds, pageSize, (page - 1) * pageSize).all();

  const members = (res.results || []).map(m => ({
    id: m.id,
    phone: m.phone,
    created_at: m.created_at,
    last_login_at: m.last_login_at,
    order_count: m.order_count || 0,
  }));

  return json({ members, total, page, pageSize }, 200, { 'cache-control': 'no-store' });
}

export async function onRequestPost({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: '请求格式错误' }, 400);
  }

  if (body.action === 'delete') {
    const userId = Number(body.userId);
    if (!Number.isInteger(userId) || userId < 1) return json({ error: '参数错误' }, 400);
    const user = await env.DB.prepare(`SELECT id FROM users WHERE id = ?`).bind(userId).first();
    if (!user) return json({ error: '会员不存在' }, 404);
    await env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(userId).run();
    return json({ ok: true });
  }

  if (body.action === 'clear_all') {
    if (body.confirm !== 'CLEAR_ALL') return json({ error: '缺少确认参数' }, 400);
    const r = await env.DB.prepare(`DELETE FROM users`).run();
    return json({ ok: true, deleted: (r.meta && r.meta.changes) || 0 });
  }

  return json({ error: '不支持的操作' }, 400);
}
