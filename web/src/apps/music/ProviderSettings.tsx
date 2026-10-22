import { TextField } from '@radix-ui/themes'
import { Button } from '../../ui/Button.tsx'
import { useState } from 'react'
import type { ProviderInfo } from '@binos/server/apps/music/types'
import { configureProvider } from './api.ts'
import { refreshProviders } from './providers.ts'
import styles from './music.module.css'

export function ProviderSettings({ provider }: { provider: ProviderInfo }) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  async function save(patch: Record<string, string>) {
    setSaving(true)
    setMessage('')
    try {
      await configureProvider(provider.id, patch)
      setValues({})
      setMessage('连接设置已保存。')
      await refreshProviders()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败，请重试。')
    } finally {
      setSaving(false)
    }
  }
  return (
    <section className={styles.settings} aria-label="音乐来源设置">
      <strong>{provider.name}</strong>
      <p>{provider.description}</p>
      {provider.configuration.fields.map((field) => (
        <form
          key={field.id}
          onSubmit={(event) => {
            event.preventDefault()
            void save({ [field.id]: values[field.id]?.trim() ?? '' })
          }}
        >
          <label htmlFor={`music-config-${field.id}`}>
            {field.label}
            {field.configured ? ' · 已配置' : ''}
          </label>
          <p>{field.description}</p>
          <div className={styles.keyForm}>
            <TextField.Root
              id={`music-config-${field.id}`}
              type={field.secret ? 'password' : 'text'}
              autoComplete="off"
              value={values[field.id] ?? ''}
              placeholder={field.configured ? '输入新值以替换' : field.label}
              onChange={(event) => setValues({ ...values, [field.id]: event.target.value })}
            />
            <Button
              appearance="primary"
              type="submit"
              className={styles.primary}
              disabled={saving || !values[field.id]?.trim()}
            >
              保存
            </Button>
            {field.configured && (
              <Button type="button" disabled={saving} onClick={() => void save({ [field.id]: '' })}>
                移除
              </Button>
            )}
          </div>
          <div className={styles.settingsLinks}>
            {field.links?.map((link) => (
              <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            ))}
          </div>
        </form>
      ))}
      {message && <p role="status">{message}</p>}
    </section>
  )
}
