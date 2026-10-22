import { Content, InlineAlert } from '@react-spectrum/s2'
import type { ReactNode } from 'react'

export function Alert({ children }: { children: ReactNode }) {
  return (
    <InlineAlert variant="negative" aria-label="错误">
      <Content>{children}</Content>
    </InlineAlert>
  )
}
