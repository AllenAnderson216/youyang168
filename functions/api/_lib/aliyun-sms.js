
// 阿里云「短信服务」SendSms（Dysmsapi 2017-05-25），RPC 风格 + 签名方式 V1（HMAC-SHA1）。
const ENDPOINT = 'https://dysmsapi.aliyuncs.com/';

// 阿里云要求的 URL 编码：在 encodeURIComponent 基础上，把 ! ' ( ) * 也编码，~ 保持原样。
export function percentEncode(s) {
  return encodeURIComponent(String(s))
    .replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%7E/g, '~');
}

async function hmacSha1Base64(key, text) {
  const k = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(text)));
  let bin = '';
  for (const b of sig) bin += String.fromCharCode(b);
  return btoa(bin);
}

export async function buildSignedBody(env, params) {
  const canonical = Object.keys(params)
    .sort()
    .map(k => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join('&');
  const stringToSign = `POST&${percentEncode('/')}&${percentEncode(canonical)}`;
  const signature = await hmacSha1Base64(env.ALIYUN_ACCESS_KEY_SECRET + '&', stringToSign);
  return `Signature=${percentEncode(signature)}&${canonical}`;
}

/**
 * 发送验证码短信。失败时抛出 Error，message 里带阿里云返回的 Code，便于排查。
 * 需要的环境变量：
 *   ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET  —— RAM 子账号的 AccessKey（只授予短信权限）
 *   ALIYUN_SMS_SIGN_NAME     —— 已审核通过的短信签名
 *   ALIYUN_SMS_TEMPLATE_CODE —— 已审核通过的验证码模板 CODE（形如 SMS_123456789）
 *   ALIYUN_SMS_PARAM_NAME    —— 可选，模板里验证码变量名，默认 code（模板写 ${code}）
 */
export async function sendVerifyCodeSms(env, { phone, code }) {
  const paramName = env.ALIYUN_SMS_PARAM_NAME || 'code';
  const params = {
    AccessKeyId: env.ALIYUN_ACCESS_KEY_ID,
    Action: 'SendSms',
    Format: 'JSON',
    PhoneNumbers: phone,
    RegionId: 'cn-hangzhou',
    SignName: env.ALIYUN_SMS_SIGN_NAME,
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: crypto.randomUUID(),
    SignatureVersion: '1.0',
    TemplateCode: env.ALIYUN_SMS_TEMPLATE_CODE,
    TemplateParam: JSON.stringify({ [paramName]: code }),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    Version: '2017-05-25',
  };
  const body = await buildSignedBody(env, params);
  const resp = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  let data;
  try { data = await resp.json(); } catch { throw new Error('阿里云返回了无法解析的内容 HTTP ' + resp.status); }
  if (data.Code !== 'OK') {
    throw new Error(`${data.Code || 'UNKNOWN'}: ${data.Message || ''}`);
  }
  return data;
}
