import type { FluentIcon } from '@fluentui/react-icons/headless'
import { useId } from 'react'

// app 的彩色图标。彩色图标里有渐变，同一个图标出现多次时，每次用自己的 id 前缀，互不引用
export function AppIcon({ icon: Icon, className }: { icon: FluentIcon; className?: string }) {
  return <Icon idPrefix={useId()} className={className} />
}
