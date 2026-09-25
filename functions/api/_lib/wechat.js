import { importPrivateKey, importPublicKey, rsaSign, rsaVerify, aesGcmDecrypt } from './pem.js';

const API_BASE = 'https://api.mch.weixin.qq.com';

function nonceStr() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function buildAuthHeader(env, method, urlPath, body) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = nonceStr();
  const bodyStr = body ? JSON.stringify(body) : '';
  const signStr = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${bodyStr}\n`;
  const privateKey = await importPrivateKey(env.WECHAT_PRIVATE_KEY);
  const signature = await rsaSign(privateKey, signStr);
  return `WECHATPAY2-SHA256-RSA2048 mchid="${env.WECHAT_MCHID}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${env.WECHAT_SERIAL_NO}",signature="${signature}"`;
}

/**
 * 发起 Native 支付下单，返回 code_url（用于生成二维码）
 */
export async function createNativeOrder(env, { outTradeNo, description, totalCents }) {
  const urlPath = '/v3/pay/transactions/native';
  const body = {
    appid: env.WECHAT_APPID,
    mchid: env.WECHAT_MCHID,
    description: description.slice(0, 120),
    out_trade_no: outTradeNo,
    notify_url: env.WECHAT_NOTIFY_URL,
    amount: { total: totalCents, currency: 'CNY' },
  };
  const auth = await buildAuthHeader(env, 'POST', urlPath, body);
  const resp = await fetch(API_BASE + urlPath, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      authorization: auth,
      'user-agent': 'youyang168-worker',
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok || !data.code_url) {
    throw new Error('微信下单失败: ' + (data.message || JSON.stringify(data)));
  }
  return data.code_url;
}

/**
 * 验证回调请求头签名（微信支付公钥模式）
 * 返回 true/false
 */
export async function verifyNotifySignature(env, { timestamp, nonce, body, signature, serial }) {
  if (serial !== env.WECHAT_PUBLIC_KEY_ID) {
    // 序列号不匹配当前配置的公钥，拒绝
    return false;
  }
  const message = `${timestamp}\n${nonce}\n${body}\n`;
  const publicKey = await importPublicKey(env.WECHAT_PUBLIC_KEY);
  return rsaVerify(publicKey, message, signature);
}

/**
 * 解密回调 resource 字段，返回解密后的对象（包含 out_trade_no, trade_state, transaction_id 等）
 */
export async function decryptResource(env, resource) {
  const plain = await aesGcmDecrypt(
    env.WECHAT_API_V3_KEY,
    resource.ciphertext,
    resource.nonce,
    resource.associated_data
  );
  return JSON.parse(plain);
}

/**
 * 发起退款
 */
export async function createRefund(env, { outTradeNo, outRefundNo, reason, refundCents, totalCents }) {
  const urlPath = '/v3/refund/domestic/refunds';
  const body = {
    out_trade_no: outTradeNo,
    out_refund_no: outRefundNo,
    reason: (reason || '客户申请退款').slice(0, 80),
    notify_url: env.WECHAT_NOTIFY_URL, // 退款结果也走同一回调地址体系（此实现以查询/管理员核对为准）
    amount: { refund: refundCents, total: totalCents, currency: 'CNY' },
  };
  const auth = await buildAuthHeader(env, 'POST', urlPath, body);
  const resp = await fetch(API_BASE + urlPath, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      authorization: auth,
      'user-agent': 'youyang168-worker',
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error('微信退款失败: ' + (data.message || JSON.stringify(data)));
  }
  // data.status: SUCCESS | CLOSED | PROCESSING | ABNORMAL
  return { refundNo: data.refund_id || outRefundNo, status: data.status };
}
