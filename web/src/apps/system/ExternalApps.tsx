import { AddRegular } from '@fluentui/react-icons/headless/svg/add'
import { ChevronRightRegular } from '@fluentui/react-icons/headless/svg/chevron-right'
import { useState } from 'react'
import { icons, iconNames } from '../external/icons.ts'
import { saveExternalApps, useExternalApps } from '../external/registry.ts'
import type { ExternalAppConfig } from '../external/registry.ts'
import { AppIcon as ColorIcon } from '../../ui/AppIcon.tsx'
import { Button } from '../../ui/Button.tsx'
import { Field } from '../../ui/Field.tsx'
import { Input } from '../../ui/Input.tsx'
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
    <section className={styles.section}>
      <header className={styles.header}>
        <h2>外部 app</h2>
        <Button size="small" icon={<AddRegular />} disabled={editing !== null} onClick={() => setEditing({ index: null, draft: newApp() })}>
          添加
        </Button>
      </header>
      <p className={styles.hint}>独立部署的 web app，在窗口里打开。清单存在这台 Mac 的系统数据里，不在 binOS 的代码中；app 本身要允许被 binos.app 嵌入。</p>
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
                <ChevronRightRegular className={styles.chevron} />
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
  )
}

function AppIcon({ name }: { name: ExternalAppConfig['icon'] }) {
  return <ColorIcon icon={icons[name]} className={styles.appIcon} />
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
      <Field label="名称">
        <Input value={draft.name} onChange={(event) => set({ name: event.target.value })} autoFocus />
      </Field>
      <Field label="网址">
        <Input
          type="url"
          value={draft.url}
          placeholder="https://"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(event) => set({ url: event.target.value })}
        />
      </Field>
      <div className={styles.field}>
        <span>图标</span>
        <div className={styles.icons}>
          {iconNames.map((name) => (
            <button key={name} type="button" aria-label={name} aria-pressed={draft.icon === name} onClick={() => set({ icon: name })}>
              <AppIcon name={name} />
            </button>
          ))}
        </div>
      </div>
      <div className={styles.actions}>
        {onRemove &&
          (confirming ? (
            <Button className={styles.danger} onClick={onRemove}>
              确认删除
            </Button>
          ) : (
            <Button onClick={() => setConfirming(true)}>删除</Button>
          ))}
        <span className={styles.spacer} />
        <Button onClick={onCancel}>取消</Button>
        <Button type="submit" appearance="primary" disabled={!valid}>
          保存
        </Button>
      </div>
    </form>
  )
}
