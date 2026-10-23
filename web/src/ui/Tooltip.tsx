import * as Primitive from '@radix-ui/react-tooltip'
import type { ReactElement, ReactNode } from 'react'
import styles from './Tooltip.module.css'

export const TooltipProvider = Primitive.Provider

// M3 的纯文本提示：反色小块，只在有悬停的设备上出现
export function Tooltip({ label, children, side = 'bottom' }: { label: ReactNode; children: ReactElement; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <Primitive.Root>
      <Primitive.Trigger asChild>{children}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content className={styles.tooltip} side={side} sideOffset={4} collisionPadding={8}>
          {label}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  )
}
