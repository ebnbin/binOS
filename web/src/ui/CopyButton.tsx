import { Check, Copy, CircleAlert } from './icons'
import { useEffect, useState } from 'react'
import styles from './CopyButton.module.css'

export function CopyButton({ text, label = '复制' }: { text: string; label?: string }) {
  const [state, setState] = useState<'ready' | 'copied' | 'failed'>('ready')
  const copied = state === 'copied'
  const title = copied ? '已复制' : state === 'failed' ? '复制失败，点击重试' : label
  useEffect(() => {
    if (state === 'ready') {
      return
    }
    const timer = window.setTimeout(() => setState('ready'), 1500)
    return () => window.clearTimeout(timer)
  }, [state])
  return (
    <button
      type="button"
      className={styles.button}
      title={title}
      aria-label={title}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setState('copied')
        } catch {
          setState('failed')
        }
      }}
    >
      {copied ? (
        <Check />
      ) : state === 'failed' ? (
        <CircleAlert />
      ) : (
        <Copy />
      )}
    </button>
  )
}
