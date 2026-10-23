import { Button, DropdownMenu, IconButton, Select, Text } from '@radix-ui/themes'
import { Fragment, useEffect, useEffectEvent, useRef, useState } from 'react'
import type { ClipboardEvent, DragEvent, KeyboardEvent } from 'react'
import type { QueuedMessage, SessionSummary } from '@binos/server/apps/code/types'
import { agents } from '@binos/server/services/kita/types'
import { PendingAttachments } from '../../../services/kita/session/Attachments.tsx'
import { Usage } from './Usage.tsx'
import type { PendingFile } from '../../../services/kita/session/Attachments.tsx'
import type { Choice, SendMode } from './Conversation.tsx'
import { sendQueued, withdrawQueued } from '../api.ts'
import { effortName, useAgentCatalogs } from '../../../services/kita/models.ts'
import styles from './Composer.module.css'
import { IconButton as GhostIconButton } from '../../../ui/IconButton.tsx'
import { ArrowUpIcon, ClockIcon, Cross2Icon, LightningBoltIcon, ListPlusIcon, MixerHorizontalIcon, PaperclipIcon } from '../../../ui/icons.ts'

// 触屏设备上回车换行，用按钮发送；有键盘的设备上回车发送，Shift+回车换行
const enterSends = !window.matchMedia('(pointer: coarse)').matches

let nextKey = 0

// 没发出去的文字按对话存在浏览器里，切走再回来、刷新页面都还在
const draftStorageKey = (key: number | string) => `code/draft/${key}`

const hasFiles = (event: { dataTransfer: DataTransfer | null }) => event.dataTransfer?.types.includes('Files') ?? false

// 有键盘的设备上 ⌘/Ctrl+回车：正在回答时排队，没在回答时发送
const queueShortcut = navigator.platform.startsWith('Mac') ? '⌘↩' : 'Ctrl+↩'

// queue：排着队、等这一轮答完再发的消息；draftKey：草稿属于哪个对话；agentFixed：已有的 session，agent 不能换
export function Composer({
  sessionId,
  session,
  queue,
  draftKey,
  running,
  choice,
  agentFixed,
  onChoice,
  onSend,
  onStop,
}: {
  sessionId: number | null
  // 列表里这个 session 的概况，新对话时没有
  session: SessionSummary | undefined
  queue: QueuedMessage[]
  draftKey: number | string
  running: boolean
  choice: Choice
  agentFixed: boolean
  onChoice: (choice: Choice) => void
  onSend: (text: string, files: File[], mode: SendMode) => Promise<boolean>
  onStop: () => void
}) {
  const [input, setInput] = useState(() => localStorage.getItem(draftStorageKey(draftKey)) ?? '')
  const [pending, setPending] = useState<PendingFile[]>([])
  const [sending, setSending] = useState(false)
  const sendingRef = useRef(false)
  const [dragging, setDragging] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasContent = input.trim() !== '' || pending.length > 0
  const catalogs = useAgentCatalogs()
  // 能选的 agent：能用的，加上这个对话正在用的
  const choosable = catalogs.filter((catalog) => catalog.available || catalog.agent === choice.agent)
  const catalog = catalogs.find((item) => item.agent === choice.agent)
  const models = catalog?.models ?? []
  const defaultModel = models.find((model) => model.isDefault)
  const efforts = models.find((model) => model.id === (choice.model ?? defaultModel?.id))?.efforts ?? catalog?.efforts ?? []
  const selectedModel = models.find((model) => model.id === choice.model) ?? (!choice.model ? defaultModel : undefined)
  const modelValue = `${choice.agent}:${choice.model ?? defaultModel?.id ?? ''}`
  const modelGroups = choosable.map((item) => ({
    agent: item.agent,
    options: item.models.map((model) => ({
      value: `${item.agent}:${model.id}`, agent: item.agent, model,
      disabled: agentFixed && item.agent !== choice.agent,
    })),
  }))
  const modelOptions = modelGroups.flatMap((group) => group.options)
  const effortValues = ['', ...new Set([...efforts, ...(choice.effort ? [choice.effort] : [])])]
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

  useEffect(() => {
    if (input) {
      localStorage.setItem(draftStorageKey(draftKey), input)
    } else {
      localStorage.removeItem(draftStorageKey(draftKey))
    }
  }, [draftKey, input])

  // 切到别的 session 时释放还没发出的预览
  const pendingRef = useRef(pending)
  useEffect(() => {
    pendingRef.current = pending
  }, [pending])
  useEffect(() => () => pendingRef.current.forEach((item) => item.preview && URL.revokeObjectURL(item.preview)), [])

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

  // 正在回答时默认是插话，agent 在下一次工具调用之间看到
  async function send(mode: SendMode = 'send') {
    if (!hasContent || sendingRef.current) return
    sendingRef.current = true
    setSending(true)
    try {
      const ok = await onSend(
        input.trim(),
        pending.map((item) => item.file),
        running ? mode : 'send',
      )
      if (ok) {
        localStorage.removeItem(draftStorageKey(draftKey))
        setInput('')
        clearPending()
      }
    } finally {
      sendingRef.current = false
      setSending(false)
      const textarea = textareaRef.current
      if (enterSends && textarea?.closest('form')?.contains(document.activeElement)) {
        textarea.focus({ preventScroll: true })
      }
    }
  }

  // 撤回排队的消息：文字回到输入框，接在已经写的后面
  async function withdraw(item: string) {
    const text = sessionId !== null ? await withdrawQueued(sessionId, item) : undefined
    if (text) {
      setInput((prev) => (prev.trim() ? `${prev.trimEnd()}\n${text}` : text))
      textareaRef.current?.focus()
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      void send('queue')
      return
    }
    if (enterSends && event.key === 'Enter' && !event.shiftKey) {
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
        {queue.length > 0 && sessionId !== null && (
          <ul className={styles.queue} aria-label="排队的消息">
            {queue.map((item) => (
              <li key={item.id}>
                <ClockIcon className={styles.queueIcon} aria-label="排队中" />
                <span className={styles.queueText}>{item.text.trim() || item.attachments?.[0]?.name}</span>
                {item.attachments?.length ? (
                  <span className={styles.queueFiles}>
                    <PaperclipIcon width={12} height={12} />
                    {item.attachments.length}
                  </span>
                ) : null}
                {/* 被停止或出错后留下的，可以现在就发 */}
                {!running && (
                  <GhostIconButton icon={ArrowUpIcon} label="现在发送" size="1" className={styles.queueButton} onClick={() => void sendQueued(sessionId, item.id)} />
                )}
                <GhostIconButton icon={Cross2Icon} label="撤回到输入框" size="1" className={styles.queueButton} onClick={() => void withdraw(item.id)} />
              </li>
            ))}
          </ul>
        )}
        {pending.length > 0 && (
          <div className={styles.attachments}>
            <PendingAttachments files={pending} onRemove={sending ? undefined : (key) => clearPending((item) => item.key !== key)} />
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
          readOnly={sending}
          aria-label="消息"
          aria-busy={sending}
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
          <GhostIconButton
            icon={PaperclipIcon}
            label={enterSends ? '添加附件（也可以粘贴或拖进来）' : '添加附件'}
            className={styles.tool}
            disabled={sending}
            onClick={() => fileInputRef.current?.click()}
          />
          <Select.Root size="2" value={modelValue} disabled={running} onValueChange={(value) => {
            const option = modelOptions.find((item) => item.value === value)
            if (!option) return
            onChoice({ agent: option.agent, model: option.model.isDefault ? undefined : option.model.id,
              ...(option.agent === choice.agent && choice.effort && option.model.efforts.includes(choice.effort) && { effort: choice.effort }) })
          }}>
            <Select.Trigger variant="ghost" color="gray" className={`${styles.tool} ${styles.model}`} aria-label="模型" title={running ? '回答结束后可切换模型' : '选择模型'}>
              {selectedModel?.name ?? choice.model ?? agents[choice.agent].name}
            </Select.Trigger>
            <Select.Content position="popper" side="top" sideOffset={8} collisionPadding={12} className={styles.modelMenu}>
              {modelGroups.map((group, index) => (
                <Fragment key={group.agent}>
                  {index > 0 && <Select.Separator />}
                  <Select.Group>
                    <Select.Label>{agents[group.agent].name}</Select.Label>
                    {group.options.map((option) => (
                      <Select.Item key={option.value} value={option.value} disabled={option.disabled}>
                        {option.model.name}
                        {option.model.isDefault && <Text color="gray" className={styles.defaultMark}>默认</Text>}
                      </Select.Item>
                    ))}
                  </Select.Group>
                </Fragment>
              ))}
              {!modelOptions.some((option) => option.value === modelValue) && (
                <Select.Item value={modelValue}>{choice.model ?? '模型信息暂不可用'}</Select.Item>
              )}
            </Select.Content>
          </Select.Root>
          <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger disabled={running}>
              <Button
                type="button"
                size="2"
                variant="ghost"
                color="gray"
                className={styles.tool}
                aria-label={`思考程度：${choice.effort ? effortName(choice.effort) : '默认'}`}
                title="思考程度"
              >
                <MixerHorizontalIcon />
                {choice.effort && effortName(choice.effort)}
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content size="2" side="top" align="start" collisionPadding={12}>
              <DropdownMenu.Label>思考程度</DropdownMenu.Label>
              <DropdownMenu.RadioGroup
                aria-label="思考程度"
                value={choice.effort ?? ''}
                onValueChange={(effort) => onChoice({ ...choice, effort: effort || undefined })}
              >
                {effortValues.map((effort) => (
                  <DropdownMenu.RadioItem key={effort} value={effort} disabled={running}>
                    {effort ? effortName(effort) : '默认'}
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
          <div className={styles.actions}>
            {session && <Usage session={session} />}
            {sending ? (
              <IconButton type="button" size="2" radius="full" loading className={styles.action} aria-label="发送中">
                <ArrowUpIcon />
              </IconButton>
            ) : running && !hasContent ? (
              <IconButton type="button" size="2" radius="full" variant="solid" color="gray" highContrast className={styles.action} onClick={onStop} aria-label="停止" title="停止">
                <span className={styles.stopIcon} />
              </IconButton>
            ) : (
              <>
                {running && (
                  <>
                    <Button
                      type="button"
                      size="2"
                      variant="soft"
                      color="gray"
                      className={styles.tool}
                      onClick={() => void send('interrupt')}
                      aria-label="打断并发送"
                      title="打断正在做的事，马上处理这句话"
                    >
                      <LightningBoltIcon />
                      打断
                    </Button>
                    <Button
                      type="button"
                      size="2"
                      variant="soft"
                      color="gray"
                      className={styles.tool}
                      onClick={() => void send('queue')}
                      aria-label="排队"
                      title={enterSends ? `排队：这一轮答完再发（${queueShortcut}）` : '排队：这一轮答完再发'}
                    >
                      <ListPlusIcon />
                      排队
                    </Button>
                  </>
                )}
                <IconButton
                  type="submit"
                  size="2"
                  radius="full"
                  variant="solid"
                  className={styles.action}
                  disabled={!canSend}
                  aria-label={running ? '插话' : '发送'}
                  title={running ? '插话：agent 在下一步看到' : '发送'}
                >
                  <ArrowUpIcon />
                </IconButton>
              </>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
