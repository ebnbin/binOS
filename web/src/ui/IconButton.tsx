import type { MaterialIcon } from './icons.tsx'
import type { ButtonHTMLAttributes } from 'react'
import { Button } from './Button.tsx'

export function IconButton({
  icon: Icon,
  label,
  className,
  ...props
}: { icon: MaterialIcon; label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button variant="icon" type="button" aria-label={label} title={label} className={className} {...props}>
      <Icon size={19} strokeWidth={1.75} />
    </Button>
  )
}
