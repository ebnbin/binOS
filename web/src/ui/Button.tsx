import { Button as RadixButton } from '@radix-ui/themes'
import type { ComponentProps, Ref } from 'react'

export type ButtonProps = ComponentProps<typeof RadixButton> & {
  appearance?: 'primary' | 'secondary' | 'quiet' | 'danger'
  ref?: Ref<HTMLButtonElement>
}

export function Button({ appearance = 'secondary', type = 'button', ...props }: ButtonProps) {
  return (
    <RadixButton
      size={{ initial: '3', sm: '2' }}
      data-ui="button"
      data-appearance={appearance}
      type={type}
      variant={
        appearance === 'primary' || appearance === 'danger' ? 'solid' : appearance === 'quiet' ? 'ghost' : 'soft'
      }
      color={appearance === 'danger' ? 'red' : appearance === 'primary' ? undefined : 'gray'}
      {...props}
    />
  )
}
