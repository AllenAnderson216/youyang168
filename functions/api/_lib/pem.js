// PEM <-> Web Crypto (SubtleCrypto) 工具函数
// Cloudflare Workers 运行时内置 Web Crypto API，无需额外依赖。

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// 导入商户私钥（PKCS8 格式），用于 RSA-SHA256 (PKCS1v1.5) 签名
function derLen(n) {
  if (n < 128) return [n];
  const bytes = [];
  while (n > 0) { bytes.unshift(n & 0xff); n >>= 8; }
  return [0x80 | bytes.length, ...bytes];
}

// 支付宝密钥工具可能生成 PKCS1 格式私钥（BEGIN RSA PRIVATE KEY），Web Crypto 只认 PKCS8，这里自动转换。
function pkcs1ToPkcs8(pkcs1Buf) {
  const pkcs1 = new Uint8Array(pkcs1Buf);
  const algId = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const octet = [0x04, ...derLen(pkcs1.length)];
  const inner = [0x02, 0x01, 0x00, ...algId, ...octet];
  const total = inner.length + pkcs1.length;
  const out = new Uint8Array([0x30, ...derLen(total), ...inner, ...pkcs1]);
  return out.buffer;
}

function isPkcs1(buf) {
  const b = new Uint8Array(buf);
  // SEQUENCE { INTEGER 0, ... }：PKCS1 里第二个元素是 INTEGER(modulus)，PKCS8 里是 SEQUENCE(algorithm)
  const lenBytes = b[1] & 0x80 ? (b[1] & 0x7f) : 0;
  const o = 2 + lenBytes;
  return b[o] === 0x02 && b[o + 1] === 0x01 && b[o + 2] === 0x00 && b[o + 3] === 0x02;
}

export async function importPrivateKey(pem) {
  let der = pemToArrayBuffer(pem);
  if (isPkcs1(der)) der = pkcs1ToPkcs8(der);
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

// 导入公钥（SPKI 格式），用于验签
export async function importPublicKey(pem) {
  const der = pemToArrayBuffer(pem);
  return crypto.subtle.importKey(
    'spki',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

export async function rsaSign(privateKey, message) {
  const enc = new TextEncoder().encode(message);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, enc);
  return arrayBufferToBase64(sig);
}

export async function rsaVerify(publicKey, message, signatureBase64) {
  const sig = base64ToArrayBuffer(signatureBase64);
  const enc = new TextEncoder().encode(message);
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, sig, enc);
}

export function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function base64ToArrayBuffer(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// AES-256-GCM 解密（微信支付回调 resource 字段用）
export async function aesGcmDecrypt(apiV3Key, ciphertextBase64, nonce, associatedData) {
  const keyBytes = new TextEncoder().encode(apiV3Key);
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
  const cipherBytes = base64ToArrayBuffer(ciphertextBase64);
  const iv = new TextEncoder().encode(nonce);
  const aad = new TextEncoder().encode(associatedData || '');
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 },
    key,
    cipherBytes
  );
  return new TextDecoder().decode(plainBuf);
}

export async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hmacSha256Hex(secret, text) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}
