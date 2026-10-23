import { forwardRef } from 'react'
import { ActionButton } from './ActionButton.tsx'
import type { ActionButtonProps } from './ActionButton.tsx'

// 只有图标的 quiet action button，label 是无障碍名称和提示
export const IconButton = forwardRef<HTMLButtonElement, Omit<ActionButtonProps, 'children'> & { icon: NonNullable<ActionButtonProps['icon']>; label: string }>(
  function IconButton(props, ref) {
    return <ActionButton ref={ref} quiet {...props} />
  },
)
