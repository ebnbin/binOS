import type { CSSProperties, InputHTMLAttributes } from 'react'
import styles from './Slider.module.css'

// Fluent 2 的 Slider：原生 range，已走过的一段是品牌色
export function Slider({ className, style, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const min = Number(props.min ?? 0)
  const max = Number(props.max ?? 100)
  const value = Number(props.value ?? min)
  const progress = max > min ? ((value - min) / (max - min)) * 100 : 0
  return <input type="range" className={`${styles.slider} ${className ?? ''}`} style={{ ...style, '--slider-progress': `${Math.min(100, Math.max(0, progress))}%` } as CSSProperties} {...props} />
}
