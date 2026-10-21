import { IconButton as MaterialIconButton } from '@mui/material'
import { Check, Copy, CircleAlert } from './icons.tsx'
import { useEffect, useState } from 'react'

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
    <MaterialIconButton
      type="button"
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
      {copied ? <Check size={13} /> : state === 'failed' ? <CircleAlert size={13} /> : <Copy size={13} />}
    </MaterialIconButton>
  )
}
