import * as wechat from './_lib/wechat.js';

function fail(msg) {
  return new Response(JSON.stringify({ code: 'FAIL', message: msg }), {
    status: 500,
    headers: { 'content-type': 'application/json' },
  });
}

function ok() {
  return new Response(JSON.stringify({ code: 'SUCCESS', message: '成功' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

export async function onRequestPost({ request, env }) {
  const bodyText = await request.text();
  const timestamp = request.headers.get('Wechatpay-Timestamp');
  const nonce = request.headers.get('Wechatpay-Nonce');
  const signature = request.headers.get('Wechatpay-Signature');
  const serial = request.headers.get('Wechatpay-Serial');

  if (!timestamp || !nonce || !signature || !serial) {
    return fail('缺少验签请求头');
  }

  let valid;
  try {
    valid = await wechat.verifyNotifySignature(env, { timestamp, nonce, body: bodyText, signature, serial });
  } catch (e) {
    return fail('验签异常: ' + e.message);
  }
  if (!valid) return fail('签名验证失败');

  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return fail('回调体不是合法JSON');
  }

  if (payload.event_type && payload.event_type !== 'TRANSACTION.SUCCESS') {
    // 非支付成功事件，直接确认收到即可，不做业务处理
    return ok();
  }

  let resourceData;
  try {
    resourceData = await wechat.decryptResource(env, payload.resource);
  } catch (e) {
    return fail('解密失败: ' + e.message);
  }

  const { out_trade_no, trade_state, transaction_id, amount } = resourceData;
  if (trade_state !== 'SUCCESS') {
    // 非成功状态（如 NOTPAY/CLOSED），确认收到，不更新订单
    return ok();
  }

  const order = await env.DB.prepare(`SELECT * FROM orders WHERE id = ?`).bind(out_trade_no).first();
  if (!order) return fail('订单不存在: ' + out_trade_no);

  // 金额校验：防止篡改
  if (!amount || amount.total !== order.total_cents) {
    return fail('回调金额与订单不一致');
  }

  // 幂等：同一笔交易只处理一次
  const dup = await env.DB.prepare(`SELECT id FROM payment_notifications WHERE id = ?`).bind(transaction_id).first();
  if (dup) return ok();

  if (order.status === 'pending_payment') {
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE orders SET status = 'paid', payment_method = 'wechat', payment_trade_no = ?, paid_at = datetime('now') WHERE id = ?`
      ).bind(transaction_id, out_trade_no),
      env.DB.prepare(
        `INSERT INTO payment_notifications (id, order_id, provider) VALUES (?, ?, 'wechat')`
      ).bind(transaction_id, out_trade_no),
    ]);
  }

  return ok();
}
