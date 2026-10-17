import { useState } from 'react'
import type { KeyboardEvent } from 'react'

// 触屏设备上回车换行，用按钮发送；有键盘的设备上回车发送，Shift+回车换行
const enterSends = !window.matchMedia('(pointer: coarse)').matches

// 输入框：回答进行中只能停止。onSend 返回是否发送成功，成功才清空输入
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
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault()
        void send()
      }}
    >
      <textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="输入消息"
        rows={1}
        disabled={running}
      />
      {running ? (
        <button type="button" className="stop" onClick={onStop}>
          停止
        </button>
      ) : (
        <button type="submit" disabled={!input.trim()}>
          发送
        </button>
      )}
    </form>
  )
}
