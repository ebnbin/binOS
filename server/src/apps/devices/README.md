# Devices

Devices 管理开发测试模拟器。网页、Claude 和 Codex 共用独立的本机设备服务；后端重启不结束设备服务或受管理命令。服务首次请求时启动，`binos devices serve` 也可前台运行。服务使用权限为 `0600` 的 Unix socket，数据保存在当前 `BINOS_ROOT/Library/Services/devices/`。只有管理进程写登记簿。

## 运行模式

正式实例使用真实设备，初始设备池为空。`BINOS_TEST_INSTANCE=1` 的开发实例和 PR 预览默认使用模拟设备，操作不接触真实设备。隔离真实验证需要同时显式设置 `BINOS_DEVICES_MODE=real` 和独立的 `BINOS_ROOT`。同一个目录不能混用两种模式。

真实设备初始化会创建专属 iOS device set 和专属 Android AVD，不接管、修改或清空已有模拟器。Android SDK 与已有系统镜像可以共享。`discover` 只读列出默认设备集中的 iOS 设备与正在运行的 Android 模拟器，发现结果不加入调度。

## 初始化

需要 Xcode 及 iOS runtime、Android SDK 的 platform-tools、emulator 和已有系统镜像。工具使用 `ANDROID_HOME`，未设置时使用 `~/Library/Android/sdk`；Xcode 使用系统选择的开发工具目录。

在正式实例创建池前，先确认设备规格和数量，再执行：

```sh
binos devices provision --platform android --source <已有AVD名称>
binos devices provision --platform ios --source <device-type-id> --runtime <runtime-id>
binos devices status
```

Android 来源 AVD 只读取硬件配置和镜像位置，不复制用户数据；默认从 `~/.android/avd` 读取，可用 `BINOS_ANDROID_SOURCE_AVDS` 指定来源目录。管理服务需重启才能读取改变的工具环境变量。Android 设备占用独立控制台端口，启动前核对端口可用性，清理前核对 AVD 名称。iOS 命令始终限定专属设备集。

## 会话使用

binOS 启动的 Agent 自动带 `BINOS_THREAD_ID` 和 `BINOS_DEVICES_CLI`。终端手动使用时加 `--session <身份>`。

```sh
binos devices acquire --platform both --reason '双端验证' --session example --wait 60
binos devices run --lease <租约ID> --session example -- ./gradlew assembleDebug
binos devices screenshot <设备ID> --lease <租约ID> --session example --output /tmp/screen.png
binos devices release --lease <租约ID> --session example
```

`acquire` 输出租约、设备 ID 和环境变量。没有可用设备时进入队列，退出码为 2；再次调用领取或保持排队，使用 `cancel` 取消。平台支持 `android`、`ios` 和 `both`，双端一次性分配。较早的双端申请会为需要的平台保留分配优先级，避免被连续单端申请饿死。

`run` 注入 `ANDROID_SERIAL`、`ANDROID_HOME`、`ANDROID_AVD_HOME`、`BINOS_IOS_UDID`、`BINOS_IOS_DEVICE_SET` 和工具 PATH。iOS 安装、操作命令使用：

```sh
xcrun simctl --set "$BINOS_IOS_DEVICE_SET" install "$BINOS_IOS_UDID" /path/to/App.app
```

构建 iOS 模拟器应用时可以使用 `xcodebuild -destination 'generic/platform=iOS Simulator'`，然后安装到租约设备。`run` 最长 30 分钟，执行期间自动保活，禁止释放；每个输出流上限 1 MiB，完整构建日志应重定向到文件。服务重启时核对遗留命令的进程身份后结束进程组，保留租约，由原会话重新执行命令。

没有命令执行的租约空闲 15 分钟回收；有人等待时，连续占用最多 1 小时。长时间操作间隔使用 `renew --lease <ID>`。队列失联及分配后未领取的设备 3 分钟后回收。状态查询和截图不续租。租约 ID 过期后不能继续操作已重新分配的设备。

## 清理与维护

释放或超时回收后，设备先进入清理状态。Android 关闭专属模拟器后擦除数据启动；iOS 关闭、擦除专属设备后启动。安装的应用及其数据都会清除，设备健康检查通过后才再次分配。

清理失败或空闲设备健康检查失败时进入故障状态，不自动分配。正在使用的设备故障会显示给占用者，禁止新的受管理命令；释放后再清理。`restore <设备ID>` 重新清理并恢复，`maintenance <设备ID>` 停用空闲设备；设备使用中或清理中拒绝维护。网页提供相同的维护与恢复操作。

`stop` 在没有受管理命令、清理或初始化操作时停止服务，不关闭模拟器；下一次请求重新启动。新构建请求旧服务时，先等待设备操作结束，再替换管理进程，保留登记簿和租约。当前版本不安装或修改 launchd 配置。

截图按需获取，并短时复用；截图不会为占用者续租。iOS 截图临时文件在读取后删除，操作记录最多保存 200 条。管理日志为 `manager.log`，Android 启动日志在 `emulator/<设备ID>.log`。同一 macOS 用户下的直接系统命令仍能访问设备，租约是资源调度机制。
