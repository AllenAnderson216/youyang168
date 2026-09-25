# youyang168 Cloudflare Pages 支付 V5

V6 在 V5 基础上保留支付宝电脑网站支付，并将微信支付回调/接口响应验签切换为微信支付公钥模式。

## Cloudflare Pages
- Build output directory: `.`
- 使用 Git 或 Wrangler 部署；Pages Functions 项目不能使用 Dashboard Direct Upload。
- 在 Pages > Settings > Bindings 绑定 D1，绑定名必须为 `DB`。

## D1
```bash
wrangler d1 migrations apply youyang168-orders --remote
```
会继续应用 0004。

## Secrets
### 微信（公钥模式）
- WECHAT_APPID
- WECHAT_MCHID
- WECHAT_PRIVATE_KEY
- WECHAT_SERIAL_NO
- WECHAT_NOTIFY_URL
- WECHAT_API_V3_KEY
- WECHAT_PUBLIC_KEY
- WECHAT_PUBLIC_KEY_ID

### 支付宝
- ALIPAY_APP_ID
- ALIPAY_PRIVATE_KEY
- ALIPAY_PUBLIC_KEY
- ALIPAY_NOTIFY_URL（例如 https://www.youyang168.com/api/alipay-notify）
- ALIPAY_RETURN_URL（例如 https://www.youyang168.com/order.html）

### 后台
- ADMIN_PASSWORD
- ADMIN_SESSION_SECRET

不要把任何私钥、API V3 Key、管理员密码提交到 Git 或 HTML/JS。

## 支付流程
支付宝使用 `alipay.trade.page.pay` 生成服务端签名表单，浏览器提交到支付宝官方网关。异步通知必须先验证 RSA2 签名，再校验 app_id、订单号和订单金额，最后才把订单更新为 paid。

## 上线前测试
1. 先使用支付宝沙箱/测试环境验证完整链路。
2. 验证重复通知不会重复入账。
3. 验证修改订单金额、订单号、app_id 的通知会被拒绝。
4. 生产环境再替换为正式商户参数。
