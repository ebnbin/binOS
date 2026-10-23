import { useEffect, useRef } from 'react'
import styles from './Ripple.module.css'

// M3 的按压涟漪：放在可点元素里（元素要有定位），从按下的位置扩散，松开后淡出
export function Ripple() {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const surface = ref.current!
    const host = surface.parentElement!
    const press = (event: PointerEvent) => {
      if (event.button !== 0 || host.matches(':disabled')) return
      const bounds = host.getBoundingClientRect()
      surface.style.setProperty('--ripple-x', `${event.clientX - bounds.left}px`)
      surface.style.setProperty('--ripple-y', `${event.clientY - bounds.top}px`)
      surface.style.setProperty('--ripple-size', `${Math.hypot(bounds.width, bounds.height) * 2}px`)
      surface.dataset.state = 'reset'
      void surface.offsetWidth
      surface.dataset.state = 'pressed'
    }
    const release = () => {
      if (surface.dataset.state === 'pressed') surface.dataset.state = 'released'
    }
    const releases = ['pointerup', 'pointerleave', 'pointercancel'] as const
    host.addEventListener('pointerdown', press)
    for (const type of releases) host.addEventListener(type, release)
    return () => {
      host.removeEventListener('pointerdown', press)
      for (const type of releases) host.removeEventListener(type, release)
    }
  }, [])
  return <span ref={ref} className={styles.ripple} aria-hidden />
}
