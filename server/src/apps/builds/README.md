# 移动端构建

Code 的「构建」页面管理 binOS 的 Android 和 iOS 构建，「设备」页面管理测试模拟器。构建服务在后端启动时按需拉起，独立运行，无需额外 launchd 配置。构建不申请模拟器，也不改变正式版 Web/server 的上线流程。

## 构建目标

- `android`：Debug APK，并执行单元测试和 lint。调试签名使用构建机用户的 Android debug keystore，同一构建机生成的包可覆盖安装。
- `ios-simulator`：关闭开发者签名的模拟器 `.app.zip`，不能安装到 iPhone 真机。
- `ios-adhoc`：Release archive 和 Ad Hoc IPA。需要本机 Xcode 已配置开发者账号、可用签名证书、`app.binos` 的标识和描述文件，安装设备 UDID 必须包含在描述文件中。导出选项为 `ios/ExportOptions-AdHoc.plist`，允许 Xcode 更新描述文件。不自动注册设备或上传 TestFlight。

构建机需要 Xcode 27.1 及 iOS 27 SDK、Android SDK 37 和兼容 Gradle 9.6/AGP 9.4 的 JDK。Android 使用 `ANDROID_HOME`，默认 `~/Library/Android/sdk`；使用 `JAVA_HOME`，默认 Homebrew 的 OpenJDK。临时 worktree 内移除生成的 daemon JVM 下载配置，使用构建机 JDK，并生成仅该次构建使用的 local.properties。版本名沿用工程配置，构建号由服务持久化的递增序号注入两端。

构建命令保存在 `scripts/mobile-build.sh`，在指定提交的干净 worktree 中执行。脚本接收目标参数，`BINOS_BUILD_OUTPUT` 指定产物目录，`BINOS_BUILD_NUMBER` 指定构建号。退出码为零且生成预期文件才算成功。

## 调度与数据

正式环境默认启用 Ad Hoc 构建，每 60 秒检查 origin/main 和最多 100 个打开的同仓库 PR；跨仓库 PR 不自动执行。只构建包含构建脚本的提交。同一提交、同一目标自动构建一次，失败不无限重试。新提交替换相同来源尚未开始的旧任务；运行中的任务继续。全局一次执行一个目标，各目标独立成功或失败。网页可关闭自动构建、关闭或启用自动 Ad Hoc，手动检查更新、指定 main/PR/完整提交构建、取消和重试。手动检查更新即使关闭自动构建也会检查并入队。

服务使用权限 0600 的 Unix socket。数据保存在 `Library/Apps/builds/`：`state.json` 为登记簿，`results/<构建ID>/` 包含日志、runner 身份、结果和 outputs，`work/` 是临时源码。保留最近 50 次已结束构建，排队和运行中的任务不清除。日志网页显示末尾 512 KiB，可下载完整日志。产物记录大小与 SHA-256，通过已有用户认证下载。成功的 Ad Hoc 构建可在 iPhone / iPad 上点击安装，通过 `itms-services` 获取安装清单和 IPA；链接有效期 24 小时，绑定构建 ID，后端重启即失效。系统安装器不携带浏览器凭据，因此 `/install/` 路径独立校验签名令牌，失效、被篡改、已删除构建均返回 404。仅已登录用户可签发安装链接。

runner 独立于管理服务和后端，管理服务重启后接续读取运行状态与结果。取消、60 分钟超时会结束构建进程组；runner 意外退出时管理服务核对遗留子进程身份后回收，并标记中断。失败与中断可手动重试。没有构建任务时服务可停止，下一请求重新启动。

构建脚本以当前 macOS 用户权限运行，只应构建自己信任的代码。worktree 提供源码隔离，不是权限沙箱。证书、密钥不写入仓库或构建产物。

## CLI 与验证

```sh
binos builds status
binos builds enqueue main android,ios-simulator
binos builds enqueue pr/123 ios-adhoc
binos builds retry <构建ID>
binos builds cancel <构建ID>
binos builds poll
binos builds stop
```

开发和 PR 预览默认模拟构建、关闭自动检查，产物为标记清楚的文本文件，不访问真实签名。真实验证必须同时使用独立 `BINOS_ROOT`、`BINOS_TEST_INSTANCE=1`、`BINOS_BUILDS_MODE=real`；`BINOS_BUILDS_REPO` 可指向待测仓库。删除隔离根目录前先停止服务并结束所有构建。

## 无线安装的入口配置

Cloudflare Access 需要为 `binos.app/install/*` 添加独立的 Self-hosted 应用，使用 Bypass / Include Everyone 策略。此规则只覆盖安装清单和 IPA，网页与 API 仍使用原有登录策略。有效签名令牌是安装资源的访问凭据，不应公开分享安装链接。

预览域名也需要对应的 `/install/*` Access 应用才能从 iOS 无线安装；正式版代理仅对格式符合安装资源的 GET/HEAD 请求跳过浏览器身份校验，目标预览实例仍验证令牌。模拟构建没有 IPA，不显示安装按钮。正式版上线前不要将预览安装链接指向正式版。

网页下载 IPA 不等于安装。无线安装的设备必须包含在 Ad Hoc 描述文件中，满足应用的最低系统版本，并按 iOS 提示启用开发者模式。
