import { json } from './_lib/util.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return json({ error: '缺少订单号' }, 400);

  const order = await env.DB.prepare(`SELECT * FROM orders WHERE id = ?`).bind(id).first();
  if (!order) return json({ error: '订单不存在' }, 404);

  const itemsRes = await env.DB.prepare(`SELECT product_name, price_cents, qty FROM order_items WHERE order_id = ?`).bind(id).all();
  const items = (itemsRes.results || []).map(i => ({ product_name: i.product_name, qty: i.qty }));

  return json({
    order: {
      id: order.id,
      status: order.status,
      payment_method: order.payment_method,
      total: (order.total_cents / 100).toFixed(2),
      created_at: order.created_at,
      shipping_company: order.shipping_company,
      shipping_no: order.shipping_no,
      items,
    },
  });
}
