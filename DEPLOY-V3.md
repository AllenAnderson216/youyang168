# Cloudflare Pages + D1 + 微信支付 V3 部署清单

## 1. 创建/绑定 D1

```bash
npx wrangler d1 create youyang168-orders
```

把返回的 database_id 写入 `wrangler.toml` 的 `database_id`，然后：

```bash
npx wrangler d1 migrations apply youyang168-orders --remote
```

在 Pages → Settings → Bindings 中绑定 D1，变量名必须是 `DB`。

## 2. 设置 Secrets

不要把下面值写入 Git：

- `WECHAT_APPID`
- `WECHAT_MCHID`
- `WECHAT_PRIVATE_KEY`
- `WECHAT_SERIAL_NO`
- `WECHAT_NOTIFY_URL` = `https://www.youyang168.com/api/payment-notify`
- `WECHAT_API_V3_KEY`
- `WECHAT_PLATFORM_CERT`
- `WECHAT_PLATFORM_CERT_SERIAL`

Cloudflare Pages 的 Secrets 会以加密方式保存，并通过 `context.env` 提供给 Functions。

## 3. 回调地址

微信支付商户平台中的支付通知地址必须指向：

`https://www.youyang168.com/api/payment-notify`

## 4. 部署

Pages Functions 需要通过 Git 或 Wrangler 部署，不能使用 Cloudflare Dashboard 的 Direct Upload。

## 5. 上线前检查

- D1 migration 0001、0002 均已应用
- `DB` 绑定正确
- 所有 Secrets 已配置
- `WECHAT_PLATFORM_CERT` 与 `WECHAT_PLATFORM_CERT_SERIAL` 对应
- 商户私钥与 `WECHAT_SERIAL_NO` 对应
- `WECHAT_API_V3_KEY` 为 32 字节
- 回调 URL 为 HTTPS
- 先完成一次测试订单
- 确认支付后 D1 的订单状态为 `paid`
