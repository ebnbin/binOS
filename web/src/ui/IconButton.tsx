import { IconButton as RadixIconButton, Tooltip } from '@radix-ui/themes'
import type { ComponentProps } from 'react'
import type { SystemIcon } from './icons.tsx'

export function IconButton({
  icon: Icon,
  label,
  title,
  ...props
}: { icon: SystemIcon; label: string } & ComponentProps<typeof RadixIconButton>) {
  return (
    <Tooltip content={title ?? label} delayDuration={400}>
      <RadixIconButton
        size={{ initial: '3', sm: '2' }}
        type="button"
        variant="ghost"
        color="gray"
        aria-label={label}
        {...props}
      >
        <Icon size={18} />
      </RadixIconButton>
    </Tooltip>
  )
}
