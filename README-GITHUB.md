# youyang168.com — GitHub + Cloudflare Pages

这是 youyang168 电商网站的 GitHub 部署版，适用于 Cloudflare Pages + Pages Functions + D1。

## 推荐部署方式：GitHub 自动部署

1. 在 GitHub 新建一个仓库，例如 `youyang168`。
2. 把本项目根目录全部文件上传到仓库的 `main` 分支。
3. Cloudflare → Workers & Pages → Create → Pages → Connect to Git。
4. 选择 GitHub 仓库。
5. 设置：
   - Production branch: `main`
   - Framework preset: `None`
   - Build command: `exit 0`
   - Build output directory: `.`
   - Root directory: `/`
6. 创建项目并部署。

提交代码后，Cloudflare Pages 会自动重新部署。

## D1

创建 D1 数据库：`youyang168-orders`，然后在 Pages 项目的 Settings → Bindings 中绑定：

- Type: D1 Database
- Variable name: `DB`
- Database: `youyang168-orders`

首次初始化：

```bash
npx wrangler d1 migrations apply youyang168-orders --remote
```

如果使用 Cloudflare Dashboard 管理迁移，也要按 `migrations/` 的编号顺序执行。

## Secrets

不要把以下值提交到 GitHub：

### 微信支付
- `WECHAT_APPID`
- `WECHAT_MCHID`
- `WECHAT_PRIVATE_KEY`
- `WECHAT_SERIAL_NO`
- `WECHAT_NOTIFY_URL`
- `WECHAT_API_V3_KEY`
- `WECHAT_PUBLIC_KEY`
- `WECHAT_PUBLIC_KEY_ID`

### 支付宝
- `ALIPAY_APP_ID`
- `ALIPAY_PRIVATE_KEY`
- `ALIPAY_PUBLIC_KEY`
- `ALIPAY_NOTIFY_URL`
- `ALIPAY_RETURN_URL`

### 管理后台
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`

在 Cloudflare Pages → Settings → Variables and Secrets → Secrets 中逐项添加。

## 生产环境检查

- [ ] D1 已绑定为 `DB`
- [ ] 所有支付 Secrets 已配置
- [ ] 微信/支付宝通知 URL 已指向当前正式域名
- [ ] HTTPS 正常
- [ ] 先用沙箱/测试环境完成支付闭环
- [ ] 验证重复通知不会重复入账
- [ ] 验证订单金额篡改会被拒绝
- [ ] 验证退款状态正确
- [ ] 再切换生产商户参数

## 目录

- `functions/`：Pages Functions API
- `migrations/`：D1 数据库迁移
- `admin.html`：订单管理后台
- `checkout.html`：结算/支付页面
- `order.html`：订单查询
- `wrangler.toml`：Cloudflare 配置
- `.gitignore`：禁止本地密钥和 Wrangler 临时文件进入 Git

## 注意

`wrangler.toml` 中的 `database_id` 是占位符。使用 Wrangler 执行 D1 命令前请替换为你的真实 D1 Database ID；如果完全使用 Cloudflare Pages Git Integration 部署，D1 运行时绑定以 Pages 项目中的 Binding 配置为准。


### 微信支付公钥模式

V6 使用微信支付公钥模式验签，不再要求 `WECHAT_PLATFORM_CERT` / `WECHAT_PLATFORM_CERT_SERIAL`。
- `WECHAT_PUBLIC_KEY`：微信支付公钥 PEM 全文，放入 Cloudflare Secret。
- `WECHAT_PUBLIC_KEY_ID`：微信支付公钥 ID，通常以 `PUB_KEY_ID_` 开头。
- `WECHAT_API_V3_KEY`：仍用于解密回调资源。
- `WECHAT_PRIVATE_KEY` + `WECHAT_SERIAL_NO`：仍用于商户 API v3 请求签名。
