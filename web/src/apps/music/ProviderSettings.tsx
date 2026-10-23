import { useState } from 'react'
import type { ProviderInfo } from '@binos/server/apps/music/types'
import { configureProvider } from './api.ts'
import { refreshProviders } from './providers.ts'
import { Button } from '../../ui/Button.tsx'
import { TextInput } from '../../ui/TextInput.tsx'
import styles from './music.module.css'

export function ProviderSettings({ provider }: { provider: ProviderInfo }) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  async function save(patch: Record<string, string>) {
    setSaving(true); setMessage('')
    try {
      await configureProvider(provider.id, patch)
      setValues({}); setMessage('连接设置已保存。'); await refreshProviders()
    } catch (error) { setMessage(error instanceof Error ? error.message : '保存失败，请重试。') }
    finally { setSaving(false) }
  }
  return <section className={styles.settings} aria-label="音乐来源设置">
    <header className={styles.settingsHeader}><h2>{provider.name}</h2><p>{provider.description}</p></header>
    {provider.configuration.fields.map(field => <form key={field.id} className={styles.field} onSubmit={event => { event.preventDefault(); void save({ [field.id]: values[field.id]?.trim() ?? '' }) }}>
      <label htmlFor={`music-config-${field.id}`}>{field.label}{field.configured && <span className={styles.configured}>已配置</span>}</label>
      <div className={styles.keyForm}>
        <TextInput block id={`music-config-${field.id}`} type={field.secret ? 'password' : 'text'} autoComplete="off" value={values[field.id] ?? ''} placeholder={field.configured ? '输入新值以替换' : field.label} onChange={event => setValues({ ...values, [field.id]: event.target.value })} />
        <Button type="submit" variant="primary" disabled={saving || !values[field.id]?.trim()}>保存</Button>
        {field.configured && <Button variant="danger" disabled={saving} onClick={() => void save({ [field.id]: '' })}>移除</Button>}
      </div>
      <p className={styles.fieldCaption}>{field.description}</p>
      {!!field.links?.length && <div className={styles.settingsLinks}>{field.links.map(link => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label}</a>)}</div>}
    </form>)}
    {message && <p className={styles.fieldCaption} role="status">{message}</p>}
  </section>
}
