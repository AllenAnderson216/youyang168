// 服务器端商品价目表（唯一可信来源）
// 价格单位：分。绝不信任前端传来的价格，下单时一律以此表为准。
// 如需上下架/改价，直接改这里，无需改数据库。

export const PRODUCTS = {
  'winona-spf48':          { name: '薇诺娜清透防晒乳50g',   price_cents: 19800 },
  'winona-tehu':            { name: '薇诺娜特护水乳套装',     price_cents: 39900 },
  'winona-tehu-cream':      { name: '薇诺娜第二代特护霜50g', price_cents: 26800 },
  'winona-xiubai':          { name: '薇诺娜修白水乳套装',     price_cents: 31900 },
  'winona-yinhe':            { name: '薇诺娜银核套装',         price_cents: 45800 },
  'winona-311':              { name: '薇诺娜311屏障速修套装', price_cents: 46800 },
  'winona-eye':              { name: '薇诺娜紧致眼霜',         price_cents: 24900 },
  'winona-acne':             { name: '薇诺娜净痘水洁面乳套装', price_cents: 11900 },
  'winona-rourun':           { name: '薇诺娜柔润保湿霜',       price_cents: 3900 },
  'winona-cleanser':         { name: '薇诺娜净痘清颜洁面乳',   price_cents: 6500 },
  'winona-jirun-emulsion':   { name: '薇诺娜极润保湿乳液',     price_cents: 9900 },
  'winona-311-water':        { name: '薇诺娜311屏障水',         price_cents: 18900 },
};

/**
 * 校验并规范化购物车条目，返回 { items, totalCents }
 * items: 前端传来的 [{id, qty}, ...]
 * 抛出 Error 表示商品不存在或数量非法
 */
export function priceCart(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('购物车为空');
  }
  const resolved = [];
  let totalCents = 0;
  for (const it of items) {
    const product = PRODUCTS[it.id];
    if (!product) throw new Error('商品不存在: ' + it.id);
    const qty = Number(it.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 999) {
      throw new Error('商品数量非法: ' + it.id);
    }
    const lineTotal = product.price_cents * qty;
    totalCents += lineTotal;
    resolved.push({
      product_id: it.id,
      product_name: product.name,
      price_cents: product.price_cents,
      qty,
    });
  }
  return { items: resolved, totalCents };
}
