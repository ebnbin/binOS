# Mail

Mail 是 binOS 的内置 Gmail 客户端。账号通过 Gmail API 收取邮件，正文、附件和原始邮件缓存于当前实例的 `Library/Apps/mail/`。HTML 正文由禁用脚本和同源权限的 iframe 展示。

## 连接账号

1. 在 [Google Cloud Console](https://console.cloud.google.com/) 创建项目并启用 Gmail API。
2. 配置 Google Auth Platform 的品牌和受众。个人 Gmail 选择 External；开发测试期间添加自己的邮箱为测试用户。
3. 创建 **Web 应用** 类型的 OAuth 客户端。将 Mail 设置中显示的完整回调地址添加到“已获授权的重定向 URI”。正式版为 `https://binos.app/api/apps/mail/oauth/callback`；PR 预览使用各自域名；本机测试使用 `pnpm dev` 输出的页面地址和同一路径。
4. 下载客户端 JSON，在 Mail 中导入并保存，然后点击“连接 Gmail”。也可手动填写 Client ID 和 Client secret。
5. 授予 `gmail.modify` 权限，授权结束后回到 binOS。该权限支持收信、已读状态及后续发信和整理邮件，不支持绕过垃圾箱直接永久删除。

External OAuth 应用在 Testing 状态下，这类权限的 refresh token 通常在 7 天后过期。长期个人使用应配置 In production，并根据 Google 的个人使用规则处理未经验证提示。生产状态不保证 token 永不过期；撤销授权等情况需要重新连接。

参考：[Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)、[个人使用的验证例外](https://support.google.com/cloud/answer/13464323)、[token 过期](https://developers.google.com/identity/protocols/oauth2#expiration)。

## 阅读与同步

- 收件箱、所有邮件、已发送、星标、垃圾邮件和垃圾箱支持分页浏览。搜索使用 Gmail 查询语法，在当前视图内查询整个远端邮箱，不受本地缓存范围限制。
- 打开会话会读取其中全部邮件，包括已发送的回复。较早邮件可展开阅读；打开在线会话后同步标为已读，也可手动标回未读。
- 从 Gmail 获取原始 MIME 邮件，使用 MailParser 解码邮件头、字符编码、嵌套 MIME、HTML、纯文本、内嵌资源和附件。每封邮件支持下载原始 `.eml`。
- HTML 保留正常样式和表格；CID 图片及背景资源转换为内嵌数据，外部图片直接由浏览器加载。外部图片请求可能向发件人暴露打开行为；失效地址、HTTP 混合内容、外部样式和特殊字体受浏览器及隔离策略限制。
- 附件完整下载，常见图片和 PDF 支持预览。加密邮件需要额外解密能力；动态 AMP 部分不执行，显示邮件提供的 HTML／纯文本版本。
- 后端启动后自动同步，每 60 秒通过 `history.list` 获取增量变更；失败时指数退避，最长 15 分钟。手动刷新可立即重试。
- 首次同步获取近期收件箱索引并预取最近 5 封的原件；历史正文按需缓存。完整处理一轮变更后才更新游标，游标过期时重建基线并校对已有缓存。
- 离线时只能显示已缓存的列表页和完整会话，界面明确标记缓存状态。未完整缓存的会话显示加载失败，不把缺失邮件当作完整会话。

## 数据与实例隔离

`account.json` 保存 OAuth 配置和 token，仅后端读取，文件权限为 `0600`；应用目录权限为 `0700`。`mail.sqlite` 保存邮件索引、缓存列表页、正文解析结果和同步游标；`content/` 保存原件与附件。邮件不写入日志。

开发实例与 PR 预览使用独立的根目录，不借用正式版邮件凭证。各实例须单独配置与授权。断开账号会清除该实例的 token 和邮件缓存，保留客户端配置；Gmail 中的邮件不受影响。仅本机断开不会撤销 Google 端授权，可在 Google 账号的第三方连接设置中撤销。

本地缓存用于客户端访问，不是独立备份：Gmail 中删除的邮件会在同步后从缓存中移除。
