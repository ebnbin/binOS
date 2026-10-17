import { ArrowUp } from 'lucide-react'
import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import styles from './Composer.module.css'

// 触屏设备上回车换行，用按钮发送；有键盘的设备上回车发送，Shift+回车换行
const enterSends = !window.matchMedia('(pointer: coarse)').matches

export function Composer({
  running,
  onSend,
  onStop,
}: {
  running: boolean
  onSend: (text: string) => Promise<boolean>
  onStop: () => void
}) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function send() {
    const text = input.trim()
    if (text && !running && (await onSend(text))) {
      setInput('')
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (enterSends && event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void send()
    }
  }

  return (
    <div className={styles.dock}>
      <form
        className={styles.card}
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            textareaRef.current?.focus()
          }
        }}
      >
        <textarea
          ref={textareaRef}
          className={styles.input}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={running ? '正在回答…' : '输入消息'}
          rows={1}
          disabled={running}
          autoFocus={enterSends}
        />
        <div className={styles.bar}>
          {enterSends && <span className={styles.hint}>Enter 发送，Shift + Enter 换行</span>}
          {running ? (
            <button type="button" className={styles.action} onClick={onStop} aria-label="停止" title="停止">
              <span className={styles.stopIcon} />
            </button>
          ) : (
            <button type="submit" className={styles.action} disabled={!input.trim()} aria-label="发送" title="发送">
              <ArrowUp size={17} strokeWidth={2.2} />
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
