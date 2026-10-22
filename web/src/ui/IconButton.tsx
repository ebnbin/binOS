import type { SystemIcon } from './icons.tsx'
import type { ButtonProps } from './Button.tsx'
import { Button } from './Button.tsx'

export function IconButton({ icon: Icon, label, ...props }: { icon: SystemIcon; label: string } & ButtonProps) {
  return (
    <Button type="button" aria-label={label} title={label} {...props}>
      <Icon />
    </Button>
  )
}
