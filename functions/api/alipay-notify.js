import * as alipay from './_lib/alipay.js';

function respond(text) {
  return new Response(text, { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

export async function onRequestPost({ request, env }) {
  const bodyText = await request.text();
  const params = Object.fromEntries(new URLSearchParams(bodyText));

  if (params.app_id !== env.ALIPAY_APP_ID) return respond('failure');

  let valid;
  try {
    valid = await alipay.verifyNotify(env, params);
  } catch (e) {
    return respond('failure');
  }
  if (!valid) return respond('failure');

  const { out_trade_no, trade_status, trade_no, total_amount } = params;
  if (!out_trade_no) return respond('failure');

  const order = await env.DB.prepare(`SELECT * FROM orders WHERE id = ?`).bind(out_trade_no).first();
  if (!order) return respond('failure');

  // 金额校验（支付宝金额单位是元，订单金额存的是分）
  const orderYuan = (order.total_cents / 100).toFixed(2);
  if (total_amount !== orderYuan) return respond('failure');

  if (trade_status !== 'TRADE_SUCCESS' && trade_status !== 'TRADE_FINISHED') {
    return respond('success'); // 其他状态：确认收到，不处理业务
  }

  // 幂等
  const dup = await env.DB.prepare(`SELECT id FROM payment_notifications WHERE id = ?`).bind(trade_no).first();
  if (dup) return respond('success');

  if (order.status === 'pending_payment') {
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE orders SET status = 'paid', payment_method = 'alipay', payment_trade_no = ?, paid_at = datetime('now') WHERE id = ?`
      ).bind(trade_no, out_trade_no),
      env.DB.prepare(
        `INSERT INTO payment_notifications (id, order_id, provider) VALUES (?, ?, 'alipay')`
      ).bind(trade_no, out_trade_no),
    ]);
  }

  return respond('success');
}
