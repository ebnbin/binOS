import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import styles from './CopyButton.module.css'

export function CopyButton({ text, label = '复制' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) {
      return
    }
    const timer = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [copied])
  return (
    <button
      type="button"
      className={styles.button}
      title={copied ? '已复制' : label}
      aria-label={copied ? '已复制' : label}
      onClick={() => void navigator.clipboard.writeText(text).then(() => setCopied(true))}
    >
      {copied ? <Check size={13} strokeWidth={2} /> : <Copy size={13} strokeWidth={1.75} />}
    </button>
  )
}
