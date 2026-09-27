import { json } from './_lib/util.js';
import { verifySession } from './_lib/session.js';

export async function onRequestPost({ request, env }) {
  const authed = await verifySession(request, env.ADMIN_SESSION_SECRET || '');
  if (!authed) return json({ error: '未登录' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: '请求格式错误' }, 400);
  }

  const { orderId, action } = body;
  if (!orderId || !['ship', 'complete', 'delete'].includes(action)) {
    return json({ error: '参数错误' }, 400);
  }

  const order = await env.DB.prepare(`SELECT * FROM orders WHERE id = ?`).bind(orderId).first();
  if (!order) return json({ error: '订单不存在' }, 404);

  if (action === 'delete') {
    // 只允许彻底删除“待付款”或“已取消”的订单：这两种状态从未产生过真实收款，
    // 已付款/已发货/已完成的订单一律不能这样删掉，需要走退款流程，避免误删真实交易记录。
    if (!['pending_payment', 'cancelled'].includes(order.status)) {
      return json({ error: '只有待付款或已取消的订单可以删除' }, 409);
    }
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM order_items WHERE order_id = ?`).bind(orderId),
      env.DB.prepare(`DELETE FROM orders WHERE id = ?`).bind(orderId),
    ]);
    return json({ ok: true });
  }

  if (action === 'ship') {
    if (order.status !== 'paid') return json({ error: '只有已付款订单可以发货' }, 409);
    const shippingCompany = String(body.shippingCompany || '').trim();
    const shippingNo = String(body.shippingNo || '').trim();
    if (!shippingCompany || !shippingNo) return json({ error: '请填写快递公司和单号' }, 400);
    await env.DB.prepare(
      `UPDATE orders SET status = 'shipped', shipping_company = ?, shipping_no = ?, shipped_at = datetime('now') WHERE id = ?`
    ).bind(shippingCompany, shippingNo, orderId).run();
    return json({ ok: true });
  }

  if (action === 'complete') {
    if (order.status !== 'shipped') return json({ error: '只有已发货订单可以标记完成' }, 409);
    await env.DB.prepare(
      `UPDATE orders SET status = 'completed', completed_at = datetime('now') WHERE id = ?`
    ).bind(orderId).run();
    return json({ ok: true });
  }

  return json({ error: '不支持的操作' }, 400);
}
