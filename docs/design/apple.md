# binOS 界面设计

binOS 是个人操作系统。桌面用于打开应用和查看小组件，应用保留各自的内容结构；导航、窗口和系统控件使用同一套视觉与交互规则。

## 设计依据

本体系将 Apple Human Interface Guidelines 的布局、材质、排版、颜色、组件与无障碍原则应用于浏览器。组件由 React、CSS 和原生 HTML 控件实现。菜单与弹出层使用无样式 Radix Primitives 管理键盘和焦点；图标使用 Lucide。它不是 UIKit、AppKit 或 SwiftUI 的 Web 版本。

- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines)
- [Designing for macOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos)
- [Designing for iOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-ios)
- [Get to know the new design system](https://developer.apple.com/videos/play/wwdc2025/356/)
- [Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/)

## 层级与材质

内容、导航、临时浮层具有不同职责。

| 层       | binOS 中的用途                   | 表面                       |
| -------- | -------------------------------- | -------------------------- |
| 桌面背景 | 承载图标与小组件                 | 随浅色、深色切换的背景     |
| 内容     | 对话正文、文件列表、封面、设置组 | 不透明的内容色或分组底色   |
| 导航     | Dock、侧栏、浏览工具栏           | 具有边缘高光的导航材质     |
| 临时浮层 | 菜单、选项、预览与确认           | 更实的浮层材质与明显的投影 |

玻璃效果集中在导航和临时操作层。正文、代码和表格保持清晰的实色背景。玻璃上的按钮使用普通填充与选中态，不嵌套另一层玻璃。较大的导航区域不随经过的内容频繁切换明暗。

Web 材质通过背景透明度、模糊、饱和度、边缘与阴影构成。CSS 不提供 Apple 原生 Liquid Glass 的完整实时折射与自动亮度适应，因此浮层采用较高不透明度保障可读性。

依据：[Materials](https://developer.apple.com/design/human-interface-guidelines/materials)。

## 布局

- 通过空间、对齐和分组表达关系；边框用于区分必要的边界。
- 页面最上方和前导侧放主要内容与常用动作。
- 宽度取决于应用实际可用空间，应用内使用容器查询，分屏中的窄应用同样进入紧凑布局。
- 宽屏中的导航与详情并排；窄屏中的 Code 导航与详情逐级展示，并保留返回入口。
- 不因窗口变窄而删除功能。文件的次要动作进入“更多文件操作”；选中项、剪贴板和确认行为保持一致。
- 桌面由 CSS Grid 排列；按内容顺序自动放置，支持 4、8、12 列，图标与小组件使用明确的格数。
- 布局尊重安全区域、独立运行时的标题栏以及软键盘引起的可视高度变化。
- 对话正文限制行宽；监控与文件列表使用更宽的区域。

依据：[Layout](https://developer.apple.com/design/human-interface-guidelines/layout)、[Split views](https://developer.apple.com/design/human-interface-guidelines/split-views)。

## 排版

字体使用系统字体栈。在 Apple 设备上采用系统提供的字体，中文由系统中文字体呈现。代码使用系统等宽字体。不分发 Apple 字体文件。

| Token                | 默认尺寸        | 用途                   |
| -------------------- | --------------- | ---------------------- |
| `--type-large-title` | 34px            | 页面主标题与主要数值   |
| `--type-title`       | 22px            | 应用标题、封面标题     |
| `--type-headline`    | 17px            | 工具栏标题与设置组标题 |
| `--type-body`        | 15px；触屏 16px | 列表与一般界面文字     |
| `--type-footnote`    | 13px            | 说明与次要操作         |
| `--type-caption`     | 12px            | 日期、状态与元信息     |

这些是 Web 实现的默认值，不把 CSS 像素等同于原生平台的 point。字号用 rem 表达，保留浏览器缩放。正文优先常规字重，标题用 Semibold，避免用细字重承载小字号信息。数值与时间使用等宽数字；中英文混排不强制大写或统一添加字距。

依据：[Typography](https://developer.apple.com/design/human-interface-guidelines/typography)。

## 颜色

颜色按意义命名，组件不根据某个固定灰色推断背景层级。

- `--color-label`、`--color-label-secondary`、`--color-label-tertiary`：主要内容、说明与较弱的辅助信息。
- `--color-content`、`--color-secondary`、`--color-elevated`：内容、分组背景和高层表面。
- `--color-accent`：主要操作、链接和当前选择；同一屏避免所有操作都变成强强调按钮。
- 红色：错误与破坏性动作；绿色：正常状态；橙色：注意与过期状态。
- 浅色与深色分别定义颜色，不通过整体反相得到深色主题。
- 状态同时提供文字、形状或图标。选中状态同时具有背景、标记或可访问状态。
- 小尺寸前景文字优先保证对比度，不用极淡的灰色作为可读内容。

依据：[Color](https://developer.apple.com/design/human-interface-guidelines/color)。

## 图标

应用图标使用独立色彩、圆角背景、简洁前景和轻微的层次。桌面与 Dock 使用同一个 `AppIcon`，紧凑尺寸保持相同身份。界面动作采用单色线性图标；图标与相邻文字的视觉重量保持一致。

装饰图标对辅助技术隐藏。只有图标的按钮具有可访问名称；提示文字不承担唯一的名称来源。外部应用的运行时配置不写入设计源文件。

依据：[Icons](https://developer.apple.com/design/human-interface-guidelines/icons)、[App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons)。

## 控件

### 按钮

`Button` 提供主要、次要、文字和破坏性四种角色。`IconButton` 提供圆形的工具栏动作。通过填充与颜色强调主要动作，同组按钮保持一致尺寸。按下后提供即时反馈，不等待网络请求完成才反馈。禁用、选中、展开和焦点具有独立状态。

鼠标环境的基础高度为 32px；触屏主要控件目标为 44px。紧凑控件可通过外围点击区域扩大目标，不能与相邻动作重叠。

依据：[Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)。

### 工具栏与侧栏

`Toolbar` 分成前导动作、标题和尾部动作；标题不与图标争抢空间。侧栏只呈现导航层级与当前选择。构建、设备、项目与对话在 Code 导航中分组；低频文件操作放入更多菜单。

依据：[Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars)、[Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars)。

### 输入与选择

单行值使用 input，消息使用 textarea。字段具有持续可访问名称，placeholder 说明预期输入。消息框支持多行、附件、输入法合成与既有发送快捷键。选择器与复选框使用原生 select 和 checkbox，保留平台键盘与辅助技术行为，包括空字符串选项。触屏文本输入采用至少 16px 的文字。

依据：[Text fields](https://developer.apple.com/design/human-interface-guidelines/text-fields)、[Search fields](https://developer.apple.com/design/human-interface-guidelines/search-fields)、[Toggles](https://developer.apple.com/design/human-interface-guidelines/toggles)。

### 列表与菜单

列表通过统一的行对齐、主次文字和必要分隔线组织信息。持久导航的当前项与临时按压状态分开处理。菜单项目使用明确动作名称，禁用项目继续可见。菜单支持方向键、Home/End、Escape 和关闭后的焦点恢复。

依据：[Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables)、[Menus](https://developer.apple.com/design/human-interface-guidelines/menus)。

### Sheet 与预览

确认与重命名用原生模态 dialog，打开时锁定背景交互，关闭后恢复焦点。提供取消入口，操作繁忙时禁止中断不完整的提交。文件预览在宽屏为独立面板，窄屏为接近全高的 sheet；元信息按需呈现。长时间的应用操作保留在应用内部。

依据：[Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets)。

### 媒体控制

播放信息、进度、传输动作、音量与队列分别成组。封面保留内容自身色彩。进度与音量使用原生 range 的键盘与读屏语义；这是浏览器内播放器控制，并非系统音频输出选择器。禁用的播放能力保持可见，并显示原因。

依据：[Sliders](https://developer.apple.com/design/human-interface-guidelines/sliders)、[Playing audio](https://developer.apple.com/design/human-interface-guidelines/playing-audio)。

## 动效与无障碍

- 按压反馈即时；菜单和浮层从触发点附近出现；动画不阻塞动作执行。
- 140ms 用于快速状态，240ms 用于一般变化，360ms 为呈现动效的上限 token。
- 减少动态效果时关闭位移与循环动画，状态文字继续存在。
- 减少透明度时使用实色表面；增加对比度时增强前景与分隔，不依赖模糊传达层级。
- 浏览器缩放保持可用。内容在增加字号、窄屏和分屏时仍可滚动访问。
- 所有交互具有键盘入口和可见焦点；错误信息采用 alert，暂态进度提供文字状态。

依据：[Motion](https://developer.apple.com/design/human-interface-guidelines/motion)、[Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)。

## 代码入口

- `web/src/design/tokens.css`：排版、间距、尺寸、圆角、颜色、材质与动效。
- `web/src/design/controls.css`：原生输入、进度与模态表面。
- `web/src/design/Components.tsx`：按钮、工具栏、导航分栏与空状态。
- `web/src/design/AppIcon.tsx`：桌面与 Dock 的应用图标。
- `web/src/index.css`：全局基础、焦点、选区与偏好适配。
- 各应用的 CSS Modules：应用内容的布局与专用呈现。

新增界面先确定内容、导航和临时层的职责，再选择 token 与组件。颜色和尺寸的共享定义放在 design 中，应用样式负责内容布局。
