// 独立运行的 iOS 页面预留顶部采样区，让系统状态栏读取 Shell 的背景。
export function reserveStatusBarTint() {
  if ((navigator as Navigator & { standalone?: boolean }).standalone) {
    document.documentElement.style.setProperty('--status-bar-tint', '6px')
  }
}
