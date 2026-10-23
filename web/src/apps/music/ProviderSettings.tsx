import { useState } from 'react'
import type { ProviderInfo } from '@binos/server/apps/music/types'
import { configureProvider } from './api.ts'
import { refreshProviders } from './providers.ts'
import { Button } from '../../ui/Button.tsx'
import field from '../../ui/Field.module.css'
import type from '../../ui/Typography.module.css'
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
    <h2 className={type.titleS}>{provider.name}</h2><p className={styles.settingsDescription}>{provider.description}</p>
    {provider.configuration.fields.map(item => <form key={item.id} className={styles.settingsField} onSubmit={event => { event.preventDefault(); void save({ [item.id]: values[item.id]?.trim() ?? '' }) }}>
      <label htmlFor={`music-config-${item.id}`} className={field.label}>{item.label}{item.configured ? ' · 已配置' : ''}</label>
      <div className={styles.keyForm}>
        <input id={`music-config-${item.id}`} className={field.textField} type={item.secret ? 'password' : 'text'} autoComplete="off" value={values[item.id] ?? ''} placeholder={item.configured ? '输入新值以替换' : item.label} onChange={event => setValues({ ...values, [item.id]: event.target.value })} />
        <Button type="submit" variant="accent" disabled={saving || !values[item.id]?.trim()}>保存</Button>
        {item.configured && <Button variant="secondary" disabled={saving} onClick={() => void save({ [item.id]: '' })}>移除</Button>}
      </div>
      <p className={field.helpText}>{item.description}</p>
      {item.links && item.links.length > 0 && <div className={styles.settingsLinks}>{item.links.map(link => <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className={type.link}>{link.label}</a>)}</div>}
    </form>)}
    {message && <p role="status" className={styles.settingsMessage}>{message}</p>}
  </section>
}
