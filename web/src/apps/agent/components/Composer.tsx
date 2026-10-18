import { ArrowUp, Paperclip, Zap } from 'lucide-react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { ClipboardEvent, DragEvent, KeyboardEvent } from 'react'
import { PendingAttachments } from './Attachments.tsx'
import type { PendingFile } from './Attachments.tsx'
import styles from './Composer.module.css'
import { IconButton } from '../../../ui/IconButton.tsx'
import { Spinner } from '../../../ui/Spinner.tsx'

// 触屏设备上回车换行，用按钮发送；有键盘的设备上回车发送，Shift+回车换行
const enterSends = !window.matchMedia('(pointer: coarse)').matches

let nextKey = 0

const hasFiles = (event: { dataTransfer: DataTransfer | null }) => event.dataTransfer?.types.includes('Files') ?? false

export function Composer({
  running,
  onSend,
  onStop,
}: {
  running: boolean
  onSend: (text: string, files: File[], interrupt: boolean) => Promise<boolean>
  onStop: () => void
}) {
  const [input, setInput] = useState('')
  const [pending, setPending] = useState<PendingFile[]>([])
  const [sending, setSending] = useState(false)
  const [dragging, setDragging] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasContent = input.trim() !== '' || pending.length > 0
  const canSend = !sending && hasContent

  function addFiles(files: File[]) {
    if (!sending) {
      const added = files.map((file) => ({
        key: nextKey++,
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      }))
      setPending((prev) => [...prev, ...added])
    }
  }

  function clearPending(keep: (item: PendingFile) => boolean = () => false) {
    pending.filter((item) => !keep(item) && item.preview).forEach((item) => URL.revokeObjectURL(item.preview!))
    setPending(pending.filter(keep))
  }

  // 切到别的 session 时释放还没发出的预览
  const pendingRef = useRef(pending)
  useEffect(() => {
    pendingRef.current = pending
  }, [pending])
  useEffect(
    () => () => pendingRef.current.forEach((item) => item.preview && URL.revokeObjectURL(item.preview)),
    [],
  )

  // 文件拖到页面哪里都能放下，不让浏览器直接打开它
  const onWindowDrop = useEffectEvent((files: File[]) => addFiles(files))
  useEffect(() => {
    const onDragOver = (event: globalThis.DragEvent) => {
      if (hasFiles(event)) {
        event.preventDefault()
      }
    }
    const onDrop = (event: globalThis.DragEvent) => {
      if (hasFiles(event)) {
        event.preventDefault()
        setDragging(false)
        onWindowDrop([...(event.dataTransfer?.files ?? [])])
      }
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  // 正在回答时发出的是插话，agent 在下一次工具调用之间看到；interrupt 时先打断正在做的事
  async function send(interrupt = false) {
    if (!canSend) {
      return
    }
    setSending(true)
    const ok = await onSend(input.trim(), pending.map((item) => item.file), interrupt)
    setSending(false)
    if (ok) {
      setInput('')
      clearPending()
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (enterSends && event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void send()
    }
  }

  // 粘贴截图之类的文件时当作附件；复制的是文字时照常粘贴文字
  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = [...event.clipboardData.files]
    if (files.length && !event.clipboardData.types.includes('text/plain')) {
      event.preventDefault()
      addFiles(files)
    }
  }

  function onDragOver(event: DragEvent) {
    if (hasFiles(event)) {
      setDragging(true)
    }
  }

  function onDragLeave(event: DragEvent) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDragging(false)
    }
  }

  return (
    <div className={styles.dock}>
      <form
        className={`${styles.card} ${dragging ? styles.dragging : ''}`}
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            textareaRef.current?.focus()
          }
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        {pending.length > 0 && (
          <div className={styles.attachments}>
            <PendingAttachments
              files={pending}
              onRemove={sending ? undefined : (key) => clearPending((item) => item.key !== key)}
            />
          </div>
        )}
        <textarea
          ref={textareaRef}
          className={styles.input}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder={running ? '补充或纠正，agent 会在下一步看到' : '输入消息'}
          rows={1}
          disabled={sending}
          autoFocus={enterSends}
        />
        <div className={styles.bar}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(event) => {
              addFiles([...(event.target.files ?? [])])
              // 清掉选择，移除后还能再选同一个文件
              event.target.value = ''
            }}
          />
          <IconButton
            icon={Paperclip}
            label={enterSends ? '添加附件（也可以粘贴或拖进来）' : '添加附件'}
            className={styles.attach}
            disabled={sending}
            onClick={() => fileInputRef.current?.click()}
          />
          {enterSends && <span className={styles.hint}>Enter 发送，Shift + Enter 换行</span>}
          {sending ? (
            <span className={`${styles.action} ${styles.busy}`}>
              <Spinner />
            </span>
          ) : running && !hasContent ? (
            <button type="button" className={styles.action} onClick={onStop} aria-label="停止" title="停止">
              <span className={styles.stopIcon} />
            </button>
          ) : (
            <>
              {running && (
                <button
                  type="button"
                  className={styles.interrupt}
                  onClick={() => void send(true)}
                  aria-label="打断并发送"
                  title="打断正在做的事，马上处理这句话"
                >
                  <Zap size={14} strokeWidth={2} />
                  打断
                </button>
              )}
              <button
                type="submit"
                className={styles.action}
                disabled={!canSend}
                aria-label={running ? '插话' : '发送'}
                title={running ? '插话：agent 在下一步看到' : '发送'}
              >
                <ArrowUp size={17} strokeWidth={2.2} />
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  )
}
