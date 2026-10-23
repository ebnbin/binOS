import { AlertIcon, CheckIcon, CopyIcon } from '@primer/octicons-react'
import { useEffect, useState } from 'react'
import { IconButton } from './IconButton.tsx'
import styles from './CopyButton.module.css'

// Primer ClipboardCopy：复制后短暂显示绿色对勾
export function CopyButton({ text, label = '复制' }: { text: string; label?: string }) {
  const [state, setState] = useState<'ready' | 'copied' | 'failed'>('ready')
  const title = state === 'copied' ? '已复制' : state === 'failed' ? '复制失败，点击重试' : label
  useEffect(() => {
    if (state === 'ready') {
      return
    }
    const timer = window.setTimeout(() => setState('ready'), 1500)
    return () => window.clearTimeout(timer)
  }, [state])
  return (
    <IconButton
      icon={state === 'copied' ? CheckIcon : state === 'failed' ? AlertIcon : CopyIcon}
      label={title}
      size="small"
      className={styles.button}
      data-state={state}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setState('copied')
        } catch {
          setState('failed')
        }
      }}
    />
  )
}
