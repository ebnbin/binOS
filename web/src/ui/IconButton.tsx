import type { ComponentProps, ReactNode } from 'react'
import { Button } from './Button.tsx'

// 只有图标的按钮，默认是 Fluent 的 subtle 外观。label 同时是无障碍名称和悬停提示
export function IconButton({ icon, label, appearance = 'subtle', ...props }: { icon: ReactNode; label: string } & Omit<ComponentProps<typeof Button>, 'icon' | 'children'>) {
  return <Button appearance={appearance} icon={icon} aria-label={label} title={label} {...props} />
}
