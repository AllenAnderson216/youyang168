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
export async function importPrivateKey(pem) {
  const der = pemToArrayBuffer(pem);
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
