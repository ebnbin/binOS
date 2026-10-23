import { Button, Card, Flex, Heading, IconButton, Text, TextField } from '@radix-ui/themes'
import { useId, useState } from 'react'
import { PlusIcon } from '../../ui/icons.ts'
import { icons, iconNames } from '../external/icons.ts'
import { saveExternalApps, useExternalApps } from '../external/registry.ts'
import type { ExternalAppConfig } from '../external/registry.ts'
import styles from './ExternalApps.module.css'

// index 为 null 时是新加的
type Editing = { index: number | null; draft: ExternalAppConfig }

function isWebUrl(url: string) {
  try {
    return ['https:', 'http:'].includes(new URL(url).protocol)
  } catch {
    return false
  }
}

const newApp = (): ExternalAppConfig => ({ id: crypto.randomUUID().slice(0, 8), name: '', icon: 'app-window', url: '' })

// 外部 app 的清单：增删改后整份写回 app 注册表
export function ExternalApps() {
  const list = useExternalApps() ?? []
  const [editing, setEditing] = useState<Editing | null>(null)

  const save = ({ index, draft }: Editing) => {
    const app = { ...draft, name: draft.name.trim(), url: draft.url.trim() }
    saveExternalApps(index === null ? [...list, app] : list.map((item, at) => (at === index ? app : item)))
    setEditing(null)
  }
  const remove = (index: number) => {
    saveExternalApps(list.filter((_, at) => at !== index))
    setEditing(null)
  }

  return (
    <Card size="2" asChild>
      <section>
        <Flex align="center" justify="between" gap="3">
          <Heading as="h3" size="3">
            外部 app
          </Heading>
          <Button size="1" variant="soft" disabled={editing !== null} onClick={() => setEditing({ index: null, draft: newApp() })}>
            <PlusIcon />
            添加
          </Button>
        </Flex>
        <Text as="p" size="2" color="gray" mt="1" mb="3">
          独立部署的 web app，在窗口里打开。清单存在这台 Mac 的系统数据里，不在 binOS 的代码中；app 本身要允许被 binos.app 嵌入。
        </Text>
        <ul className={styles.list}>
          {list.map((app, index) =>
            editing?.index === index ? (
              <li key={app.id}>
                <Editor editing={editing} onChange={setEditing} onSave={save} onCancel={() => setEditing(null)} onRemove={() => remove(index)} />
              </li>
            ) : (
              <li key={app.id}>
                <button type="button" className={styles.row} disabled={editing !== null} onClick={() => setEditing({ index, draft: app })}>
                  <AppIcon name={app.icon} />
                  <span className={styles.name}>{app.name}</span>
                  <span className={styles.url}>{app.url}</span>
                </button>
              </li>
            ),
          )}
          {editing?.index === null && (
            <li>
              <Editor editing={editing} onChange={setEditing} onSave={save} onCancel={() => setEditing(null)} />
            </li>
          )}
        </ul>
      </section>
    </Card>
  )
}

function AppIcon({ name }: { name: ExternalAppConfig['icon'] }) {
  const Icon = icons[name]
  return <Icon />
}

function Editor({
  editing,
  onChange,
  onSave,
  onCancel,
  onRemove,
}: {
  editing: Editing
  onChange: (editing: Editing) => void
  onSave: (editing: Editing) => void
  onCancel: () => void
  onRemove?: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const iconLabel = useId()
  const { draft } = editing
  const set = (changes: Partial<ExternalAppConfig>) => onChange({ ...editing, draft: { ...draft, ...changes } })
  const valid = draft.name.trim() !== '' && isWebUrl(draft.url.trim())

  return (
    <form
      className={styles.editor}
      onSubmit={(event) => {
        event.preventDefault()
        if (valid) {
          onSave(editing)
        }
      }}
    >
      <label className={styles.field}>
        <Text size="2" weight="medium">
          名称
        </Text>
        <TextField.Root value={draft.name} onChange={(event) => set({ name: event.target.value })} autoFocus />
      </label>
      <label className={styles.field}>
        <Text size="2" weight="medium">
          网址
        </Text>
        <TextField.Root
          type="url"
          value={draft.url}
          placeholder="https://"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(event) => set({ url: event.target.value })}
        />
      </label>
      <div className={styles.field} role="group" aria-labelledby={iconLabel}>
        <Text id={iconLabel} size="2" weight="medium">
          图标
        </Text>
        <div className={styles.icons}>
          {iconNames.map((name) => {
            const selected = draft.icon === name
            return (
              <IconButton
                key={name}
                type="button"
                variant={selected ? 'solid' : 'ghost'}
                color={selected ? undefined : 'gray'}
                aria-label={name}
                aria-pressed={selected}
                onClick={() => set({ icon: name })}
              >
                <AppIcon name={name} />
              </IconButton>
            )
          })}
        </div>
      </div>
      <Flex align="center" gap="3" wrap="wrap">
        {onRemove &&
          (confirming ? (
            <Button type="button" color="red" onClick={onRemove}>
              确认删除
            </Button>
          ) : (
            <Button type="button" variant="soft" color="red" onClick={() => setConfirming(true)}>
              删除
            </Button>
          ))}
        <Flex gap="3" ml="auto">
          <Button type="button" variant="soft" color="gray" onClick={onCancel}>
            取消
          </Button>
          <Button type="submit" disabled={!valid}>
            保存
          </Button>
        </Flex>
      </Flex>
    </form>
  )
}
