import * as Primitive from '@radix-ui/react-slider'
import type { ComponentProps } from 'react'
import styles from './Slider.module.css'

type SliderProps = Omit<ComponentProps<typeof Primitive.Root>, 'children' | 'aria-label'> & {
  label: string
  valueText?: string
}

export function Slider({ label, valueText, className, ...props }: SliderProps) {
  return (
    <Primitive.Root className={`${styles.root} ${className ?? ''}`} {...props}>
      <Primitive.Track className={styles.track}>
        <Primitive.Range className={styles.range} />
      </Primitive.Track>
      <Primitive.Thumb className={styles.thumb} aria-label={label} aria-valuetext={valueText} />
    </Primitive.Root>
  )
}
