// iOS Safari 弹出键盘时不缩小页面，而是把整个页面往上推，顶栏会被推出屏幕。
// 让页面高度跟随可见区域，并把页面滚回原位；其他浏览器里可见区域和页面一样高，没有影响
export function followVisualViewport() {
  const viewport = window.visualViewport
  if (!viewport) {
    return
  }
  const update = () => {
    // 双指放大时可见区域也会变小，这时不跟随
    if (viewport.scale > 1.01) {
      return
    }
    document.documentElement.style.setProperty('--viewport-height', `${viewport.height}px`)
    if (window.scrollY !== 0) {
      window.scrollTo(0, 0)
    }
  }
  viewport.addEventListener('resize', update)
  viewport.addEventListener('scroll', update)
  update()
}

// iOS 的双指缩放手势。index.css 的 touch-action 挡不住时由这里挡
export function preventPinchZoom() {
  for (const type of ['gesturestart', 'gesturechange']) {
    document.addEventListener(type, (event) => event.preventDefault(), { passive: false })
  }
}
