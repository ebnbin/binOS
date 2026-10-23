import { useEffect, useState } from 'react'
import { ActionButton } from './ActionButton.tsx'
import { AlertTriangle, Checkmark, Copy } from './icons.tsx'

export function CopyButton({ text, label = '复制', className }: { text: string; label?: string; className?: string }) {
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
    <ActionButton
      quiet
      size="S"
      className={className}
      label={title}
      icon={copied ? Checkmark : state === 'failed' ? AlertTriangle : Copy}
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
