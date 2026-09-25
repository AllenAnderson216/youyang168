import { json } from './_lib/util.js';
import { verifySession } from './_lib/session.js';

export async function onRequestGet({ request, env }) {
  const authed = await verifySession(request, env.ADMIN_SESSION_SECRET || '');
  if (!authed) return json({ error: '未登录' }, 401);

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const status = (url.searchParams.get('status') || '').trim();

  let sql = `SELECT * FROM orders WHERE 1=1`;
  const binds = [];
  if (status) {
    sql += ` AND status = ?`;
    binds.push(status);
  }
  if (q) {
    sql += ` AND (id LIKE ? OR customer_name LIKE ? OR phone LIKE ?)`;
    const like = `%${q}%`;
    binds.push(like, like, like);
  }
  sql += ` ORDER BY created_at DESC LIMIT 200`;

  const res = await env.DB.prepare(sql).bind(...binds).all();
  const orders = (res.results || []).map(o => ({
    id: o.id,
    customer_name: o.customer_name,
    phone: o.phone,
    address: o.address,
    total_cents: o.total_cents,
    status: o.status,
    payment_method: o.payment_method,
    payment_trade_no: o.payment_trade_no,
    refund_status: o.refund_status,
    shipping_company: o.shipping_company,
    shipping_no: o.shipping_no,
    created_at: o.created_at,
    paid_at: o.paid_at,
  }));

  return json({ orders });
}
