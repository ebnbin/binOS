import { useEffect, useState } from 'react'
import { Check, ContentCopy, ErrorIcon } from './icons.tsx'
import { IconButton } from './IconButton.tsx'

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
    <IconButton
      icon={copied ? Check : state === 'failed' ? ErrorIcon : ContentCopy}
      label={title}
      size="xs"
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
