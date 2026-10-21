import { Button } from '@fluentui/react-components'
import { CheckmarkRegular as Check, CopyRegular as Copy, WarningRegular as CircleAlert } from '@fluentui/react-icons'
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
    <Button
      size="small"
      appearance="subtle"
      type="button"
      icon={copied ? <Check fontSize={16} /> : state === 'failed' ? <CircleAlert fontSize={16} /> : <Copy fontSize={16} />}
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
    />
  )
}
