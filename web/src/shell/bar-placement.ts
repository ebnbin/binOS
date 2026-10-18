import { useEffect, useState } from 'react'

// 控制栏的位置：一般在屏幕下面；手机横过来高度不到 480 时放在侧边，避开灵动岛或摄像头那一边；手机上打字时隐藏，把空间留给 app
export type BarPlacement = 'bottom' | 'left' | 'right' | 'hidden'

const sideBarBelow = 480

function read(): BarPlacement {
  const touch = window.matchMedia('(pointer: coarse)').matches
  if (!touch) {
    return 'bottom'
  }
  const target = document.activeElement
  if (target instanceof HTMLElement && (target.isContentEditable || target.matches('input:not([type=button], [type=checkbox], [type=radio]), textarea, select'))) {
    return 'hidden'
  }
  if (window.innerHeight >= sideBarBelow) {
    return 'bottom'
  }
  // landscape-primary 是逆时针转过来，摄像头在左边
  return window.screen.orientation?.type === 'landscape-secondary' ? 'left' : 'right'
}

export function useBarPlacement() {
  const [placement, setPlacement] = useState(read)
  useEffect(() => {
    // 失去焦点后，焦点可能马上又落到另一个输入框上，等这一轮事件结束再读
    const update = () => window.setTimeout(() => setPlacement(read))
    window.addEventListener('resize', update)
    window.screen.orientation?.addEventListener('change', update)
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    return () => {
      window.removeEventListener('resize', update)
      window.screen.orientation?.removeEventListener('change', update)
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', update)
    }
  }, [])
  return placement
}
