import { IconButton as Base } from '@radix-ui/themes'
import type { ComponentProps } from 'react'
import type { Icon } from './icons.ts'

// 只有图标的按钮。默认是 Radix Themes 的灰色 ghost 按钮，工具栏里常用；标签同时用作 tooltip
export function IconButton({
  icon: Glyph,
  label,
  variant = 'ghost',
  color = 'gray',
  size = '2',
  ...props
}: { icon: Icon; label: string } & Omit<ComponentProps<typeof Base>, 'children'>) {
  return (
    <Base type="button" aria-label={label} title={label} variant={variant} color={color} size={size} {...props}>
      <Glyph />
    </Base>
  )
}
