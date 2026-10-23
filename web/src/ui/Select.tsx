import { Select as Base } from '@radix-ui/themes'

type Option = { value: string; label: string; disabled?: boolean }

export function Select({ value, options, onValueChange, label, title, disabled, className, size = '2', variant = 'surface' }: {
  value: string
  options: Option[]
  onValueChange: (value: string) => void
  label: string
  title?: string
  disabled?: boolean
  className?: string
  size?: '1' | '2' | '3'
  variant?: 'surface' | 'soft' | 'ghost'
}) {
  // Radix 的空字符串用于清除选择；加前缀让业务里的默认选项也能被选中。
  const encode = (value: string) => `option:${value}`
  return (
    <Base.Root value={encode(value)} onValueChange={(next) => onValueChange(next.slice(7))} disabled={disabled} size={size}>
      <Base.Trigger aria-label={label} title={title} variant={variant} color="gray" className={className} />
      <Base.Content position="popper" sideOffset={4} collisionPadding={8}>
        {options.map((option) => (
          <Base.Item key={option.value} value={encode(option.value)} disabled={option.disabled}>
            {option.label}
          </Base.Item>
        ))}
      </Base.Content>
    </Base.Root>
  )
}
