-- 会员系统：手机号 + 短信验证码登录（注册即登录）

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL UNIQUE,          -- 11 位大陆手机号
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

-- 短信验证码记录：只存哈希，不存明文；同时用于发送频率限制
CREATE TABLE IF NOT EXISTS sms_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  ip TEXT,
  attempts INTEGER NOT NULL DEFAULT 0, -- 已输错次数
  used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,         -- 毫秒时间戳
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sms_phone ON sms_codes(phone, created_at);
CREATE INDEX IF NOT EXISTS idx_sms_ip ON sms_codes(ip, created_at);
CREATE INDEX IF NOT EXISTS idx_sms_created ON sms_codes(created_at);
