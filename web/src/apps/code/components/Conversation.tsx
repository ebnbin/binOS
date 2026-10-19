import type { Attachment, SessionSummary } from '@binos/server/apps/code/types'
import { defaultProvider } from '@binos/server/services/agent/types'
import type { Provider } from '@binos/server/services/agent/types'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { markRead, maxUploadBytes, sendMessage, stopSession, uploadFile } from '../api.ts'
import { useSession } from '../useSession.ts'
import { Alert } from './Alert.tsx'
import { Composer } from './Composer.tsx'
import styles from './Conversation.module.css'
import { Transcript } from './Transcript.tsx'
import { BrandMark } from '../../../ui/BrandMark.tsx'

// 离底部不超过这个距离时，新内容到来会自动滚到底；往上翻看时不打扰
const stickThreshold = 80

// provider 只在新对话时能选，已有的 session 沿用它的
export type Choice = { provider: Provider; model?: string; effort?: string }

// session：列表里这个 session 的概况，新对话时没有
export function Conversation({
  sessionId,
  session,
  onCreated,
}: {
  sessionId: number | null
  session: SessionSummary | undefined
  onCreated: (id: number) => void
}) {
  const { records, live } = useSession(sessionId)
  const running = live !== null
  // 下一轮用的模型和思考程度，没选过就沿用这个 session 最近一轮的
  const [picked, setPicked] = useState<Choice>()
  const choice = picked ?? { provider: session?.provider ?? defaultProvider, model: session?.model, effort: session?.effort }

  // 正在看、又没在回答：记为已读（打开时，以及这一轮答完时）
  useEffect(() => {
    if (sessionId !== null && !running) {
      void markRead(sessionId)
    }
  }, [sessionId, running])
  const [notice, setNotice] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && stick.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [records, live, notice])

  function stop() {
    if (sessionId !== null) {
      void stopSession(sessionId)
    }
  }

  async function send(text: string, files: File[], interrupt: boolean) {
    setNotice('')
    stick.current = true
    const tooLarge = files.find((file) => file.size > maxUploadBytes)
    if (tooLarge) {
      setNotice(`${tooLarge.name} 太大，附件最大 ${maxUploadBytes / 1024 / 1024} MB`)
      return false
    }
    const uploads = await Promise.all(files.map(uploadFile))
    const attachments: Attachment[] = []
    for (const upload of uploads) {
      if ('error' in upload) {
        setNotice(upload.error)
        return false
      }
      attachments.push(upload)
    }
    const result = await sendMessage(sessionId, text, attachments, { interrupt, ...choice })
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
            <Transcript sessionId={sessionId} records={records} live={live} />
          )}
          {notice && <Alert>{notice}</Alert>}
        </div>
      </div>
      <Composer
        running={running}
        choice={choice}
        providerFixed={sessionId !== null}
        onChoice={setPicked}
        onSend={send}
        onStop={stop}
      />
    </>
  )
}
