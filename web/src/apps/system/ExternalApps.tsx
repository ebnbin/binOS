import { useState } from 'react'
import { ActionButton } from '../../ui/ActionButton.tsx'
import { Button } from '../../ui/Button.tsx'
import field from '../../ui/Field.module.css'
import { Add } from '../../ui/icons.tsx'
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
    <section className={styles.section}>
      <header className={styles.header}>
        <h3 className={styles.title}>外部 app</h3>
        <ActionButton icon={Add} disabled={editing !== null} onClick={() => setEditing({ index: null, draft: newApp() })}>
          添加
        </ActionButton>
      </header>
      <p className={styles.hint}>独立部署的 web app，在窗口里打开。清单存在这台 Mac 的系统数据里，不在 binOS 的代码中；app 本身要允许被 binos.app 嵌入。</p>
      {(list.length > 0 || editing?.index === null) && (
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
                  <span className={styles.text}>
                    <span className={styles.name}>{app.name}</span>
                    <span className={styles.url}>{app.url}</span>
                  </span>
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
      )}
    </section>
  )
}

function AppIcon({ name }: { name: ExternalAppConfig['icon'] }) {
  const Icon = icons[name]
  return <Icon size="M" />
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
      <label className={styles.field}>
        <span className={field.label}>名称</span>
        <input className={field.textField} value={draft.name} onChange={(event) => set({ name: event.target.value })} autoFocus />
      </label>
      <label className={styles.field}>
        <span className={field.label}>网址</span>
        <input
          className={field.textField}
          type="url"
          value={draft.url}
          placeholder="https://"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(event) => set({ url: event.target.value })}
        />
      </label>
      <div className={styles.field} role="group" aria-labelledby={`${draft.id}-icon`}>
        <span className={field.label} id={`${draft.id}-icon`}>
          图标
        </span>
        <div className={styles.icons}>
          {iconNames.map((name) => (
            <ActionButton key={name} icon={icons[name]} label={name} quiet selected={draft.icon === name} onClick={() => set({ icon: name })} />
          ))}
        </div>
      </div>
      <div className={styles.actions}>
        {onRemove &&
          (confirming ? (
            <Button variant="negative" onClick={onRemove}>
              确认删除
            </Button>
          ) : (
            <Button variant="secondary" fillStyle="outline" onClick={() => setConfirming(true)}>
              删除
            </Button>
          ))}
        <span className={styles.spacer} />
        <Button variant="secondary" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" variant="accent" disabled={!valid}>
          保存
        </Button>
      </div>
    </form>
  )
}
