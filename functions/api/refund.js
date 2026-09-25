import { json, genOrderId } from './_lib/util.js';
import { verifySession } from './_lib/session.js';
import * as wechat from './_lib/wechat.js';
import * as alipay from './_lib/alipay.js';

export async function onRequestPost({ request, env }) {
  const authed = await verifySession(request, env.ADMIN_SESSION_SECRET || '');
  if (!authed) return json({ error: '未登录' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: '请求格式错误' }, 400);
  }

  const { orderId, amountCents, reason } = body;
  const order = await env.DB.prepare(`SELECT * FROM orders WHERE id = ?`).bind(orderId).first();
  if (!order) return json({ error: '订单不存在' }, 404);
  if (!['paid', 'shipped'].includes(order.status)) {
    return json({ error: '订单状态不支持退款' }, 409);
  }
  if (!Number.isInteger(amountCents) || amountCents < 1 || amountCents > order.total_cents) {
    return json({ error: '退款金额无效' }, 400);
  }
  if (!order.payment_method) {
    return json({ error: '订单没有支付方式记录，无法自动退款' }, 400);
  }

  const outRefundNo = 'RF' + genOrderId();

  try {
    if (order.payment_method === 'wechat') {
      const result = await wechat.createRefund(env, {
        outTradeNo: order.id,
        outRefundNo,
        reason,
        refundCents: amountCents,
        totalCents: order.total_cents,
      });
      // 微信退款常见先返回 PROCESSING，不能当作已完成
      const status = result.status === 'SUCCESS' ? 'success' : 'processing';
      await env.DB.prepare(
        `UPDATE orders SET refund_status = ?, refund_amount_cents = ?, refund_no = ?, refund_reason = ? WHERE id = ?`
      ).bind(status, amountCents, result.refundNo, reason || null, orderId).run();
      return json({ ok: true, status });
    }

    if (order.payment_method === 'alipay') {
      await alipay.createRefund(env, {
        outTradeNo: order.id,
        refundAmountYuan: amountCents / 100,
        reason,
      });
      // 支付宝退款接口同步返回成功即表示退款受理成功
      await env.DB.prepare(
        `UPDATE orders SET refund_status = 'success', refund_amount_cents = ?, refund_no = ?, refund_reason = ? WHERE id = ?`
      ).bind(amountCents, outRefundNo, reason || null, orderId).run();
      return json({ ok: true, status: 'success' });
    }
  } catch (e) {
    return json({ error: e.message || '退款失败' }, 500);
  }

  return json({ error: '不支持的支付方式' }, 400);
}
