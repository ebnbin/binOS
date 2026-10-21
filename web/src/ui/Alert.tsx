import { MessageBar, MessageBarBody } from '@fluentui/react-components'
import type { ReactNode } from 'react'

export function Alert({ children }: { children: ReactNode }) {
  return (
    <MessageBar intent="error">
      <MessageBarBody>{children}</MessageBarBody>
    </MessageBar>
  )
}
