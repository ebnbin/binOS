import type { Attachment, SessionSummary } from '@binos/server/apps/code/types'
import { defaultProvider } from '@binos/server/services/agent/types'
import type { Provider } from '@binos/server/services/agent/types'
import { ArrowDown } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { markRead, maxUploadBytes, sendMessage, stopSession, uploadFile } from '../api.ts'
import { useSession } from '../useSession.ts'
import { Alert } from './Alert.tsx'
import { Composer } from './Composer.tsx'
import styles from './Conversation.module.css'
import { Transcript } from './Transcript.tsx'
import { BrandMark } from '../../../ui/BrandMark.tsx'

// 离底部不超过这个距离时，新内容到来会自动滚到底；往上翻看时不打扰
const stickThreshold = 80

// 正在回答时：插话（agent 在下一步看到）、先打断再说、排到这一轮答完之后
export type SendMode = 'send' | 'interrupt' | 'queue'

// provider 只在新对话时能选，已有的 session 沿用它的
export type Choice = { provider: Provider; model?: string; effort?: string }

// session：列表里这个 session 的概况，新对话时没有
// scrollRef：对话滚动的那一层，顶栏用它回到顶部
export function Conversation({
  sessionId,
  session,
  scrollRef,
  onCreated,
}: {
  sessionId: number | null
  session: SessionSummary | undefined
  scrollRef: RefObject<HTMLDivElement | null>
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
  const stick = useRef(true)
  // 往上翻看时，下方出现回到底部的按钮
  const [awayFromBottom, setAwayFromBottom] = useState(false)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && stick.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [scrollRef, records, live, notice])

  function stop() {
    if (sessionId !== null) {
      void stopSession(sessionId)
    }
  }

  async function send(text: string, files: File[], mode: SendMode) {
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
    const result = await sendMessage(sessionId, text, attachments, { ...(mode === 'interrupt' && { interrupt: true }), ...(mode === 'queue' && { queue: true }), ...choice })
    if ('error' in result) {
      setNotice(result.error)
      return false
    }
    if (sessionId === null) {
      onCreated(result.id)
    }
    return true
  }

  function scrollToBottom() {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }

  return (
    <>
      <div className={styles.viewport}>
        <div
          className={styles.scroll}
          ref={scrollRef}
          onScroll={(event) => {
            const el = event.currentTarget
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < stickThreshold
            setAwayFromBottom(!stick.current)
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
        {awayFromBottom && (
          <button type="button" className={styles.toBottom} onClick={scrollToBottom} aria-label="回到底部" title="回到底部">
            <ArrowDown size={16} strokeWidth={2} />
          </button>
        )}
      </div>
      <Composer
        sessionId={sessionId}
        queue={session?.queue ?? []}
        draftKey={sessionId ?? 'new'}
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
