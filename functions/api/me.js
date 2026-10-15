import { json } from './_lib/util.js';
import { getMemberId, maskPhone } from './_lib/member.js';

export async function onRequestGet({ request, env }) {
  const headers = { 'cache-control': 'no-store' };
  const uid = await getMemberId(request, env);
  if (!uid) return json({ loggedIn: false }, 200, headers);
  const user = await env.DB.prepare(`SELECT phone FROM users WHERE id = ?`).bind(uid).first();
  if (!user) return json({ loggedIn: false }, 200, headers);
  return json({ loggedIn: true, phone: user.phone, phoneMasked: maskPhone(user.phone) }, 200, headers);
}
