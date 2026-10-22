// iOS 26 起装成 app 时：没有固定定位的元素盖住页面顶边，iOS 会在页面顶部加一截毛玻璃；
// 状态栏的颜色不看 theme-color，取的是这个元素在顶边往下 4～6px 处实际显示的颜色。
// Shell 固定定位覆盖顶边，并留出 6px，让状态栏沿用系统表面色。只在 iPhone 装成 app 时留
export function reserveStatusBarTint() {
  if ((navigator as Navigator & { standalone?: boolean }).standalone) {
    document.documentElement.style.setProperty('--status-bar-tint', '6px')
  }
}
