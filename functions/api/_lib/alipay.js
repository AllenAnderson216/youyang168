import { importPrivateKey, importPublicKey, rsaSign, rsaVerify } from './pem.js';

const GATEWAY = 'https://openapi.alipay.com/gateway.do';

function formatTimestamp(date = new Date()) {
  // 支付宝要求北京时间 yyyy-MM-dd HH:mm:ss
  const beijing = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${beijing.getUTCFullYear()}-${pad(beijing.getUTCMonth() + 1)}-${pad(beijing.getUTCDate())} ${pad(beijing.getUTCHours())}:${pad(beijing.getUTCMinutes())}:${pad(beijing.getUTCSeconds())}`;
}

function buildSignString(params) {
  return Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '' && k !== 'sign')
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
}

async function signParams(env, params) {
  const privateKey = await importPrivateKey(env.ALIPAY_PRIVATE_KEY);
  const signStr = buildSignString(params);
  const sign = await rsaSign(privateKey, signStr);
  return sign;
}

/**
 * 生成"电脑网站支付"自动提交表单 HTML。
 * 前端拿到这段 HTML 后 document.write，浏览器会自动跳转到支付宝收银台。
 */
export async function buildPagePayForm(env, { outTradeNo, subject, totalYuan }) {
  const bizContent = JSON.stringify({
    out_trade_no: outTradeNo,
    product_code: 'FAST_INSTANT_TRADE_PAY',
    total_amount: totalYuan.toFixed(2),
    subject: subject.slice(0, 200),
  });
  const params = {
    app_id: env.ALIPAY_APP_ID,
    method: 'alipay.trade.page.pay',
    format: 'JSON',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: formatTimestamp(),
    version: '1.0',
    notify_url: env.ALIPAY_NOTIFY_URL,
    return_url: env.ALIPAY_RETURN_URL,
    biz_content: bizContent,
  };
  params.sign = await signParams(env, params);

  const inputs = Object.keys(params)
    .map(k => `<input type="hidden" name="${k}" value="${escapeAttr(params[k])}">`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>正在跳转支付宝…</title></head><body>
<form id="alipay-form" action="${GATEWAY}" method="POST">${inputs}</form>
<p>正在跳转到支付宝，请稍候…</p>
<script>document.getElementById('alipay-form').submit();</script>
</body></html>`;
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 验证异步通知（application/x-www-form-urlencoded body）签名
 * formData: 已解析为普通对象的通知参数（包含 sign, sign_type）
 */
export async function verifyNotify(env, formData) {
  const sign = formData.sign;
  if (!sign) return false;
  const signStr = buildSignString(formData);
  const publicKey = await importPublicKey(env.ALIPAY_PUBLIC_KEY);
  return rsaVerify(publicKey, signStr, sign);
}

/**
 * 发起退款（服务端直接调用网关API，同步返回结果）
 */
export async function createRefund(env, { outTradeNo, refundAmountYuan, reason }) {
  const bizContent = JSON.stringify({
    out_trade_no: outTradeNo,
    refund_amount: refundAmountYuan.toFixed(2),
    refund_reason: (reason || '客户申请退款').slice(0, 200),
  });
  const params = {
    app_id: env.ALIPAY_APP_ID,
    method: 'alipay.trade.refund',
    format: 'JSON',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: formatTimestamp(),
    version: '1.0',
    biz_content: bizContent,
  };
  params.sign = await signParams(env, params);

  const body = new URLSearchParams(params).toString();
  const resp = await fetch(GATEWAY, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await resp.json();
  const result = data.alipay_trade_refund_response;
  if (!result || result.code !== '10000') {
    throw new Error('支付宝退款失败: ' + JSON.stringify(result));
  }
  return { success: true, raw: result };
}
