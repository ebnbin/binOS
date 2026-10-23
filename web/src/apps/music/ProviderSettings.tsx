import { Button, Card, Link, Text, TextField } from '@radix-ui/themes'
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
    setSaving(true); setMessage('')
    try {
      await configureProvider(provider.id, patch)
      setValues({}); setMessage('连接设置已保存。'); await refreshProviders()
    } catch (error) { setMessage(error instanceof Error ? error.message : '保存失败，请重试。') }
    finally { setSaving(false) }
  }
  return <Card asChild size="2"><section className={styles.settings} aria-label="音乐来源设置">
    <div>
      <Text as="p" size="2" weight="bold">{provider.name}</Text>
      <Text as="p" size="1" color="gray">{provider.description}</Text>
    </div>
    {provider.configuration.fields.map(field => <form key={field.id} className={styles.field} onSubmit={event => { event.preventDefault(); void save({ [field.id]: values[field.id]?.trim() ?? '' }) }}>
      <Text as="label" size="2" weight="medium" htmlFor={`music-config-${field.id}`}>{field.label}{field.configured ? ' · 已配置' : ''}</Text>
      <Text as="p" size="1" color="gray">{field.description}</Text>
      <div className={styles.keyForm}>
        <TextField.Root className={styles.keyInput} id={`music-config-${field.id}`} type={field.secret ? 'password' : 'text'} autoComplete="off" value={values[field.id] ?? ''} placeholder={field.configured ? '输入新值以替换' : field.label} onChange={event => setValues({ ...values, [field.id]: event.target.value })} />
        <Button type="submit" disabled={saving || !values[field.id]?.trim()}>保存</Button>
        {field.configured && <Button type="button" variant="soft" color="red" disabled={saving} onClick={() => void save({ [field.id]: '' })}>移除</Button>}
      </div>
      {!!field.links?.length && <div className={styles.settingsLinks}>{field.links.map(link => <Link key={link.url} size="1" href={link.url} target="_blank" rel="noreferrer">{link.label}</Link>)}</div>}
    </form>)}
    {message && <Text as="p" size="1" color="gray" role="status">{message}</Text>}
  </section></Card>
}
