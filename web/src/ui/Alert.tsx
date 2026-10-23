import { Callout } from '@radix-ui/themes'
import type { ReactNode } from 'react'
import styles from './Alert.module.css'
import { ExclamationTriangleIcon } from './icons.ts'

// 出错的提示，Radix Themes 的红色 Callout
export function Alert({ children }: { children: ReactNode }) {
  return (
    <Callout.Root color="red" role="alert" size="1">
      <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
      <Callout.Text className={styles.text}>{children}</Callout.Text>
    </Callout.Root>
  )
}
