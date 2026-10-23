import * as Primitive from '@radix-ui/react-tooltip'
import type { ReactElement, ReactNode } from 'react'
import styles from './Tooltip.module.css'

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <Primitive.Provider delayDuration={400} skipDelayDuration={200}>{children}</Primitive.Provider>
}

// 触发元素自己带 aria-label 时，Tooltip 只是视觉上的补充
export function Tooltip({ text, side = 'bottom', children }: { text: string; side?: 'top' | 'bottom' | 'left' | 'right'; children: ReactElement }) {
  return (
    <Primitive.Root>
      <Primitive.Trigger asChild>{children}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content className={styles.tooltip} side={side} sideOffset={4} collisionPadding={8}>
          {text}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  )
}
