import { Button, Input } from '../../ui/Controls.tsx'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { readMusicSettings, saveYouTubeKey } from './api.ts'
import { youtubePreview } from './youtube.ts'
import styles from './music.module.css'

export function YouTubeSettings() {
  const [configured, setConfigured] = useState<boolean>()
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    let active = true
    readMusicSettings()
      .then((settings) => {
        if (active) setConfigured(settings.youtubeConfigured)
      })
      .catch(() => {
        if (active) setMessage('无法读取设置，请重新打开。')
      })
    return () => {
      active = false
    }
  }, [])
  async function save(value: string) {
    setSaving(true)
    setMessage('')
    try {
      const settings = await saveYouTubeKey(value.trim())
      setConfigured(settings.youtubeConfigured)
      setKey('')
      setMessage(settings.youtubeConfigured ? '已保存，现在可以按歌名搜索和导入公开歌单。' : '已移除搜索密钥，仍可使用单曲链接。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败，请重试。')
    } finally {
      setSaving(false)
    }
  }
  return (
    <section className={styles.settings} aria-label="YouTube 设置">
      <strong>YouTube 搜索</strong>
      <p>单曲链接无需密钥。按歌名搜索或导入公开歌单，需要启用 YouTube Data API v3 的 API 密钥。</p>
      <form
        className={styles.keyForm}
        onSubmit={(event) => {
          event.preventDefault()
          void save(key)
        }}
      >
        <Input
          type="password"
          aria-label="YouTube API 密钥"
          placeholder={configured ? '已配置，输入新密钥可替换' : '粘贴 API 密钥'}
          value={key}
          onChange={(event) => setKey(event.target.value)}
          autoComplete="off"
        />
        <Button className={styles.primary} disabled={saving || !key.trim()}>
          {saving ? '保存中…' : '保存'}
        </Button>
      </form>
      <div className={styles.settingsLinks}>
        <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noreferrer">
          启用 API
        </a>
        <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">
          创建密钥
        </a>
        {configured && (
          <Button type="button" disabled={saving} onClick={() => void save('')}>
            移除密钥
          </Button>
        )}
      </div>
      <p>密钥只保存在 binOS 服务端。请将 API 限制设为 YouTube Data API v3；请求从服务器发出，不使用网站 Referer 限制。</p>
      {message && <p role="status">{message}</p>}
    </section>
  )
}

export function YouTubeInspector() {
  const visible = useSyncExternalStore(youtubePreview.subscribe, youtubePreview.getSnapshot)
  return (
    <Button type="button" className={styles.textButton} onClick={() => youtubePreview.setVisible(!visible)}>
      {visible ? '关闭视频预览' : '视频预览'}
    </Button>
  )
}
