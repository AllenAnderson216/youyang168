import { priceCart } from './_lib/products.js';
import { json, genOrderId } from './_lib/util.js';

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: '请求格式错误' }, 400);
  }

  const customer = body.customer || {};
  const name = String(customer.name || '').trim();
  const phone = String(customer.phone || '').trim();
  const email = customer.email ? String(customer.email).trim() : null;
  const address = String(customer.address || '').trim();
  const note = customer.note ? String(customer.note).trim() : null;

  if (!name || name.length > 50) return json({ error: '姓名不合法' }, 400);
  if (!phone || phone.length > 30) return json({ error: '手机号不合法' }, 400);
  if (!address || address.length > 300) return json({ error: '收货地址不合法' }, 400);

  let priced;
  try {
    priced = priceCart(body.items);
  } catch (e) {
    return json({ error: e.message }, 400);
  }

  const orderId = genOrderId();

  try {
    const stmts = [
      env.DB.prepare(
        `INSERT INTO orders (id, customer_name, phone, email, address, note, total_cents, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_payment')`
      ).bind(orderId, name, phone, email, address, note, priced.totalCents),
      ...priced.items.map(it =>
        env.DB.prepare(
          `INSERT INTO order_items (order_id, product_id, product_name, price_cents, qty)
           VALUES (?, ?, ?, ?, ?)`
        ).bind(orderId, it.product_id, it.product_name, it.price_cents, it.qty)
      ),
    ];
    await env.DB.batch(stmts);
  } catch (e) {
    return json({ error: '订单创建失败，请稍后重试' }, 500);
  }

  return json({ orderId, totalCents: priced.totalCents });
}
