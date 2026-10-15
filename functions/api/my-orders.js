import { json } from './_lib/util.js';
import { getMemberId } from './_lib/member.js';

// 会员的订单 = 下单时填写的手机号与会员手机号一致的订单（手机号已通过短信验证，所以以前的游客订单也能看到）
export async function onRequestGet({ request, env }) {
  const headers = { 'cache-control': 'no-store' };
  const uid = await getMemberId(request, env);
  if (!uid) return json({ error: '未登录' }, 401, headers);

  const user = await env.DB.prepare(`SELECT phone FROM users WHERE id = ?`).bind(uid).first();
  if (!user) return json({ error: '未登录' }, 401, headers);

  const p = user.phone;
  const res = await env.DB.prepare(
    `SELECT id, status, total_cents, created_at, paid_at, payment_method,
            shipping_company, shipping_no, refund_status
       FROM orders
      WHERE REPLACE(REPLACE(phone, ' ', ''), '-', '') IN (?, ?, ?)
      ORDER BY created_at DESC
      LIMIT 100`
  ).bind(p, '+86' + p, '86' + p).all();
  const orders = res.results || [];

  const itemsByOrder = {};
  if (orders.length) {
    const marks = orders.map(() => '?').join(',');
    const itemsRes = await env.DB.prepare(
      `SELECT order_id, product_name, qty FROM order_items WHERE order_id IN (${marks})`
    ).bind(...orders.map(o => o.id)).all();
    for (const it of itemsRes.results || []) {
      (itemsByOrder[it.order_id] ||= []).push({ product_name: it.product_name, qty: it.qty });
    }
  }

  return json({
    orders: orders.map(o => ({
      id: o.id,
      status: o.status,
      total: (o.total_cents / 100).toFixed(2),
      created_at: o.created_at,
      paid_at: o.paid_at,
      payment_method: o.payment_method,
      refund_status: o.refund_status,
      shipping_company: o.shipping_company,
      shipping_no: o.shipping_no,
      items: itemsByOrder[o.id] || [],
    })),
  }, 200, headers);
}
