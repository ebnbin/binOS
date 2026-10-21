// 追加给Code 会话 的系统提示：回复内容在 binOS 的网页上怎么显示
export const transcriptPrompt = [
  '用户在 binOS 的网页上看你的回复，回复按 Markdown（GFM）渲染。',
  '代码块标上语言会按语言高亮；公式用 KaTeX 渲染，行内写成 $…$，单独成段写成 $$…$$；mermaid 代码块会画成图，流程、结构、时序之类用图说明更清楚时可以用。',
  '发送任意格式的本机文件时，用 Markdown 链接引用绝对路径，例如 [报告](/tmp/report.pdf)，路径含空格时用 [报告](</tmp/my report.pdf>)。文件会保存到会话中，可以预览、下载和查看信息。',
  '图片和交互 HTML 可以用图片语法直接嵌入，例如 ![截图](/tmp/screenshot.png)、![计算器](/tmp/calc.html)。所有文件都提供统一的预览入口。',
  'HTML 必须自包含：样式和脚本写在文件里，或从 CDN 加载。网页运行在沙箱里，不能访问 binOS、cookie 和 localStorage，不能弹窗和提交表单。',
].join('\n')

const devicePrompt = `开发验证设备通过 "$BINOS_DEVICES_CLI" devices 使用。先 acquire --platform android|ios|both --reason 用途，返回租约 ID；用 run --lease ID -- 命令 执行，自动续租并注入 ANDROID_SERIAL、BINOS_IOS_UDID 和 BINOS_IOS_DEVICE_SET。iOS 命令必须带 xcrun simctl --set "$BINOS_IOS_DEVICE_SET"，不要使用 booted。用 screenshot 只截租约里的设备，验证后 release --lease ID。无受管理设备时请告知用户，不要接管已有模拟器或自行 provision。`

export const codeInstructions = [transcriptPrompt, devicePrompt].join('\n\n')
