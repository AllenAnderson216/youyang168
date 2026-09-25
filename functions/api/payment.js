import { json } from './_lib/util.js';
import * as wechat from './_lib/wechat.js';
import * as alipay from './_lib/alipay.js';

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: '请求格式错误' }, 400);
  }

  const { orderId, method } = body;
  if (!orderId || !['wechat', 'alipay'].includes(method)) {
    return json({ error: '参数错误' }, 400);
  }

  const order = await env.DB.prepare(`SELECT * FROM orders WHERE id = ?`).bind(orderId).first();
  if (!order) return json({ error: '订单不存在' }, 404);
  if (order.status !== 'pending_payment') {
    return json({ error: '订单状态不允许支付' }, 409);
  }

  const items = await env.DB.prepare(`SELECT product_name FROM order_items WHERE order_id = ?`).bind(orderId).all();
  const subject = (items.results || []).map(i => i.product_name).join('、').slice(0, 120) || '云鸿商贸订单';

  try {
    if (method === 'wechat') {
      if (!env.WECHAT_APPID || !env.WECHAT_MCHID) {
        return json({ ok: false, message: '微信支付暂未配置' }, 200);
      }
      const codeUrl = await wechat.createNativeOrder(env, {
        outTradeNo: orderId,
        description: subject,
        totalCents: order.total_cents,
      });
      await env.DB.prepare(`UPDATE orders SET payment_method = 'wechat' WHERE id = ?`).bind(orderId).run();
      return json({ ok: true, codeUrl });
    }

    if (method === 'alipay') {
      if (!env.ALIPAY_APP_ID) {
        return json({ ok: false, message: '支付宝暂未配置' }, 200);
      }
      const paymentHtml = await alipay.buildPagePayForm(env, {
        outTradeNo: orderId,
        subject,
        totalYuan: order.total_cents / 100,
      });
      await env.DB.prepare(`UPDATE orders SET payment_method = 'alipay' WHERE id = ?`).bind(orderId).run();
      return json({ ok: true, paymentHtml });
    }
  } catch (e) {
    return json({ ok: false, message: e.message || '支付通道暂不可用' }, 200);
  }

  return json({ error: '不支持的支付方式' }, 400);
}
