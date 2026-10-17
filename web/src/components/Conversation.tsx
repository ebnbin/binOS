import { useEffect, useRef, useState } from 'react'
import { sendMessage, stopSession } from '../api.ts'
import { useSession } from '../useSession.ts'
import { Composer } from './Composer.tsx'
import { Transcript } from './Transcript.tsx'

// 一个 session 的对话。sessionId 为 null 时是新对话，发出第一条消息后由 onCreated 告知新 session 的编号
export function Conversation({ sessionId, onCreated }: { sessionId: number | null; onCreated: (id: number) => void }) {
  const { entries, progress, running } = useSession(sessionId)
  const [notice, setNotice] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const list = listRef.current
    list?.scrollTo({ top: list.scrollHeight, behavior: 'smooth' })
  }, [entries, progress, running, notice])

  function stop() {
    if (sessionId !== null) {
      void stopSession(sessionId)
    }
  }

  async function send(text: string) {
    setNotice('')
    const result = await sendMessage(sessionId, text)
    if ('error' in result) {
      setNotice(result.error)
      return false
    }
    if (sessionId === null) {
      onCreated(result.id)
    }
    return true
  }

  return (
    <>
      <div className="messages" ref={listRef}>
        {entries.length === 0 && !running && <p className="empty">对 binOS 的 agent 说点什么</p>}
        {sessionId !== null && <Transcript sessionId={sessionId} entries={entries} progress={progress} />}
        {running && !progress?.length && <div className="message assistant pending">正在处理…</div>}
        {notice && <div className="message system">{notice}</div>}
      </div>
      <Composer running={running} onSend={send} onStop={stop} />
    </>
  )
}
