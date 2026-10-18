import { useEffect, useRef, useState } from 'react'

// 元素的内容尺寸，跟随变化；还没量到时是 null
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  useEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize((prev) => (prev?.width === width && prev.height === height ? prev : { width, height }))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, size] as const
}
