-- youyang168 订单系统 初始建表
-- 执行: wrangler d1 migrations apply youyang168-orders --remote

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,                 -- 订单号，例如 YH20260922153000ab12
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT NOT NULL,
  note TEXT,
  total_cents INTEGER NOT NULL,        -- 订单总金额，单位：分（避免浮点误差）
  status TEXT NOT NULL DEFAULT 'pending_payment',
  -- pending_payment | paid | shipped | completed | cancelled | refunded

  payment_method TEXT,                 -- wechat | alipay
  payment_trade_no TEXT,               -- 支付平台返回的交易号

  refund_status TEXT,                  -- null | processing | success | failed
  refund_amount_cents INTEGER,
  refund_no TEXT,
  refund_reason TEXT,

  shipping_company TEXT,
  shipping_no TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT,
  shipped_at TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id),
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,        -- 下单时刻的单价快照（分）
  qty INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- 支付回调幂等表：记录已处理过的微信/支付宝通知，防止重复入账
CREATE TABLE IF NOT EXISTS payment_notifications (
  id TEXT PRIMARY KEY,                 -- 微信 notify id 或 支付宝 trade_no+notify_time 组合
  order_id TEXT NOT NULL,
  provider TEXT NOT NULL,              -- wechat | alipay
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);
