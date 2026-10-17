import { useLayoutEffect, useRef, useState } from 'react'
import { sendMessage, stopSession } from '../api.ts'
import { useSession } from '../useSession.ts'
import { Alert } from './Alert.tsx'
import { Composer } from './Composer.tsx'
import styles from './Conversation.module.css'
import { Transcript } from './Transcript.tsx'
import { BrandMark } from './ui/BrandMark.tsx'

// 离底部不超过这个距离时，新内容到来会自动滚到底；往上翻看时不打扰
const stickThreshold = 80

export function Conversation({
  sessionId,
  onCreated,
}: {
  sessionId: number | null
  onCreated: (id: number) => void
}) {
  const { entries, progress, running } = useSession(sessionId)
  const [notice, setNotice] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && stick.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [entries, progress, running, notice])

  function stop() {
    if (sessionId !== null) {
      void stopSession(sessionId)
    }
  }

  async function send(text: string) {
    setNotice('')
    stick.current = true
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
      <div
        className={styles.scroll}
        ref={scrollRef}
        onScroll={(event) => {
          const el = event.currentTarget
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < stickThreshold
        }}
      >
        <div className={styles.column}>
          {sessionId === null ? (
            <div className={styles.empty}>
              <BrandMark size={44} />
              <h1>想让 binOS 做点什么？</h1>
              <p>你说的每一句话，都可能改变这个系统本身</p>
            </div>
          ) : (
            <Transcript sessionId={sessionId} entries={entries} progress={progress} />
          )}
          {running && !progress?.length && <div className={styles.pending}>正在处理</div>}
          {notice && <Alert>{notice}</Alert>}
        </div>
      </div>
      <Composer running={running} onSend={send} onStop={stop} />
    </>
  )
}
