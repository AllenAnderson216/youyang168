import { json } from './_lib/util.js';

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: '请求格式错误' }, 400);
  }

  const orderId = String(body.orderId || '').trim();
  if (!orderId) return json({ error: '缺少订单号' }, 400);

  const order = await env.DB.prepare(`SELECT id, status FROM orders WHERE id = ?`).bind(orderId).first();
  if (!order) return json({ error: '订单不存在' }, 404);

  // 只允许取消“待付款”的订单：已付款/已发货/已完成的订单不能这样撤销，
  // 需要走退款流程（管理后台的退款功能），避免顾客把已经付款的订单“取消”掉导致账目对不上。
  if (order.status !== 'pending_payment') {
    return json({ error: '该订单当前状态不支持取消' }, 409);
  }

  await env.DB.prepare(`UPDATE orders SET status = 'cancelled' WHERE id = ?`).bind(orderId).run();

  return json({ ok: true });
}
