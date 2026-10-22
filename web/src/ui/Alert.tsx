import { Callout } from '@radix-ui/themes'
import { CircleAlert } from './icons.tsx'
import type { ReactNode } from 'react'

export function Alert({ children }: { children: ReactNode }) {
  return (
    <Callout.Root color="red" role="alert" size="1">
      <Callout.Icon>
        <CircleAlert size={16} />
      </Callout.Icon>
      <Callout.Text>{children}</Callout.Text>
    </Callout.Root>
  )
}
