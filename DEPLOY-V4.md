# youyang168 Cloudflare Pages 支付 V4

## 新增
- `/admin.html` 订单后台
- 管理员 HttpOnly Cookie 会话
- D1 订单查询、搜索、状态筛选
- 发货：快递公司 + 单号
- 完成订单
- 微信全额/部分退款申请
- 退款状态字段与退款单号

## Cloudflare Secrets
必须配置：
- ADMIN_PASSWORD：后台管理员密码
- ADMIN_SESSION_SECRET：随机长字符串，建议 32 字节以上
- WECHAT_APPID
- WECHAT_MCHID
- WECHAT_PRIVATE_KEY
- WECHAT_SERIAL_NO
- WECHAT_NOTIFY_URL
- WECHAT_API_V3_KEY
- WECHAT_PUBLIC_KEY
- WECHAT_PUBLIC_KEY_ID

不要把上述值写进 HTML/JS，也不要提交到 Git。

## D1
依次执行：
```bash
wrangler d1 migrations apply youyang168-orders --remote
```
会应用 0001、0002、0003。

## Pages
- Build output directory: `.`
- 如果使用 Git 部署，请把整个项目根目录作为 Pages 项目。
- Functions 会从 `functions/` 自动部署。

## 后台
部署后访问：
`https://www.youyang168.com/admin.html`

后台登录使用 `ADMIN_PASSWORD`。

## 微信退款
退款接口会创建微信退款单。多数情况下微信会先返回 PROCESSING，最终结果应以微信退款通知/查询为准；V4 不会把 PROCESSING 伪装成成功。
