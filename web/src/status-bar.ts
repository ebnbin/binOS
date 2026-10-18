// iOS 26 起装成 app 的状态栏颜色不看 theme-color，而是从页面取：
// 打开时取根元素的背景，或者盖住页面顶边的固定定位元素下面实际显示的颜色；之后跟随顶边至少 6px 厚的固定定位元素，元素拿掉后颜色保持。
// 所以打开和切回来时，在顶边放一条黑色的固定定位条，iOS 取到黑色后再拿掉，不占屏幕
const band = { height: 8, duration: 500 }

export function keepStatusBarBlack() {
  if (!(navigator as Navigator & { standalone?: boolean }).standalone) {
    return
  }
  const show = () => {
    const element = document.createElement('div')
    element.setAttribute('aria-hidden', 'true')
    element.style.cssText = `position:fixed;inset:0 0 auto;height:${band.height}px;background:#000;pointer-events:none;z-index:2147483647`
    document.documentElement.appendChild(element)
    window.setTimeout(() => element.remove(), band.duration)
  }
  show()
  window.addEventListener('pageshow', show)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      show()
    }
  })
}
