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
  if (!orderId || !['ship', 'complete'].includes(action)) {
    return json({ error: '参数错误' }, 400);
  }

  const order = await env.DB.prepare(`SELECT * FROM orders WHERE id = ?`).bind(orderId).first();
  if (!order) return json({ error: '订单不存在' }, 404);

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
