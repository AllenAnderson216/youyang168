# 云鸿商贸 Cloudflare 支付系统 V6

架构：Cloudflare Pages + Pages Functions + D1。

支付：
- 微信支付 Native
- 支付宝电脑网站支付

微信支付安全模式：
- API v3 商户私钥用于请求签名
- 微信支付公钥模式用于 API 响应与回调验签（官方推荐）
- APIv3 密钥用于解密回调资源
- 回调校验公钥 ID、签名、时间戳、商户号、订单号、金额

后台：订单、搜索、状态、发货、退款。

不要把私钥、APIv3 密钥、管理员密码提交到 GitHub。
