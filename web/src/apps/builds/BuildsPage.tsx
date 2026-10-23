import { Badge, Button, Callout, Card, Code, Flex, Heading, Link, SegmentedControl, Switch, Text, TextField } from '@radix-ui/themes'
import { useCallback, useEffect, useState } from 'react'
import type { Build, Snapshot, Target } from '@binos/server/apps/builds/types'
import { Alert } from '../../ui/Alert.tsx'
import { DownloadIcon, FileTextIcon, InfoCircledIcon, MobileIcon, ReloadIcon } from '../../ui/icons.ts'
import { Select } from '../../ui/Select.tsx'
import styles from './BuildsPage.module.css'
const base = '/api/apps/builds'
const targetLabels: Record<Target, string> = { android: 'Android APK', 'ios-simulator': 'iOS 模拟器', 'ios-adhoc': 'iOS Ad Hoc' }
const statusLabels = { queued: '排队中', running: '构建中', success: '成功', failed: '失败', cancelled: '已取消', interrupted: '已中断' }
const statusColors = { queued: 'gray', running: 'blue', success: 'green', failed: 'red', cancelled: 'gray', interrupted: 'amber' } as const
const targets = [{ value: 'both', label: 'Android + iOS 模拟器' }, ...Object.entries(targetLabels).map(([value, label]) => ({ value, label }))]
const filters = [['all', '全部'], ['main', 'main'], ['pr', 'PR'], ['manual', '手动']]
async function request(body?: unknown): Promise<Snapshot> {
  const r = await fetch(base, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined)
  const data = await r.json()
  if (!r.ok) throw new Error(data.error ?? '请求失败')
  return data
}
export function BuildsPage({ initialRef = 'main' }: { initialRef?: string }) {
  const [data, setData] = useState<Snapshot>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [ref, setRef] = useState(initialRef)
  const [target, setTarget] = useState('both')
  const [filter, setFilter] = useState('all')
  const [log, setLog] = useState<Build>()
  const [text, setText] = useState('')
  const [clock, setClock] = useState(() => Date.now())
  const load = useCallback(async () => { try { setData(await request()); setClock(Date.now()); setError('') } catch (e) { setError(String(e)) } }, [])
  useEffect(() => { const initial = setTimeout(() => void load(), 0); const timer = setInterval(() => { if (!document.hidden) void load() }, 4000); return () => { clearTimeout(initial); clearInterval(timer) } }, [load])
  useEffect(() => {
    if (!log) return
    let active = true
    const read = async () => { try { const r = await fetch(`${base}/${log.id}/log`); if (!r.ok) throw new Error('日志读取失败'); const value = await r.text(); if (active) setText(value) } catch (e) { if (active) setText(String(e)) } }
    void read(); const timer = setInterval(() => void read(), 2000)
    return () => { active = false; clearInterval(timer) }
  }, [log])
  async function install(id: string) {
    setBusy(true)
    try {
      const r = await fetch(`${base}/${id}/install`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const value = await r.json()
      if (!r.ok) throw new Error(value.error ?? '无法创建安装链接')
      window.location.href = value.url
    } catch (e) { setError(String(e)) } finally { setBusy(false) }
  }
  async function act(body: unknown) { setBusy(true); try { setData(await request(body)); setError('') } catch (e) { setError(String(e)) } finally { setBusy(false) } }
  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <Heading as="h1" size="6">
            构建
          </Heading>
          <Text as="p" size="2" color="gray" mt="1">
            Android 与 iOS 的持续集成、日志和产物
          </Text>
        </div>
        <Button variant="soft" color="gray" disabled={busy} onClick={() => void act({ action: 'poll' })}>
          <ReloadIcon />
          检查更新
        </Button>
      </header>
      {data?.mode === 'mock' && (
        <Callout.Root size="1" color="blue">
          <Callout.Icon>
            <InfoCircledIcon />
          </Callout.Icon>
          <Callout.Text>预览模式：模拟构建，与正式构建及签名隔离。</Callout.Text>
        </Callout.Root>
      )}
      {error && <Alert>{error}</Alert>}
      {data?.pollError && <Alert>检查仓库失败：{data.pollError}</Alert>}
      {data && (
        <Card size="2">
          <Flex direction="column" gap="3">
            <Text as="label" size="2">
              <Flex gap="2" align="center">
                <Switch checked={data.settings.automatic} disabled={busy} onCheckedChange={(automatic) => void act({ action: 'settings', ...data.settings, automatic })} />
                自动构建 main 和 PR
              </Flex>
            </Text>
            <Text as="label" size="2">
              <Flex gap="2" align="center">
                <Switch checked={data.settings.adhoc} disabled={busy} onCheckedChange={(adhoc) => void act({ action: 'settings', ...data.settings, adhoc })} />
                自动构建 Ad Hoc（需要签名证书及已注册设备）
              </Flex>
            </Text>
            {data.checkedAt && (
              <Text size="1" color="gray">
                上次检查：{new Date(data.checkedAt).toLocaleString()}
              </Text>
            )}
          </Flex>
        </Card>
      )}
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault()
          void act({ action: 'enqueue', ref: ref.trim(), targets: target === 'both' ? ['android', 'ios-simulator'] : [target] })
        }}
      >
        <label className={styles.field}>
          <Text size="2" weight="medium">
            构建来源
          </Text>
          <TextField.Root aria-label="构建来源" required value={ref} onChange={(e) => setRef(e.target.value)} placeholder="main、pr/编号、完整提交号" />
        </label>
        <div className={styles.field}>
          <Text size="2" weight="medium">
            构建目标
          </Text>
          <Select label="构建目标" value={target} options={targets} onValueChange={setTarget} />
        </div>
        <Button disabled={busy || !data} type="submit">
          开始构建
        </Button>
      </form>
      <SegmentedControl.Root value={filter} onValueChange={setFilter} aria-label="构建筛选" className={styles.filter}>
        {filters.map(([key, label]) => (
          <SegmentedControl.Item key={key} value={key}>
            {label}
          </SegmentedControl.Item>
        ))}
      </SegmentedControl.Root>
      {!data ? (
        <Text as="p" size="2" color="gray" className={styles.empty}>
          正在连接构建服务…
        </Text>
      ) : !data.builds.length ? (
        <Text as="p" size="2" color="gray" className={styles.empty}>
          暂无构建。提交包含移动端构建脚本后将自动构建，也可以手动指定来源。
        </Text>
      ) : (
        data.builds
          .filter((b) => filter === 'all' || b.trigger === filter)
          .map((b) => (
            <Card key={b.id} size="2" asChild>
              <article className={styles.build}>
                <Flex align="center" gap="2" wrap="wrap">
                  <Text size="2" weight="medium">
                    {targetLabels[b.target]}
                  </Text>
                  <Badge size="1" variant="soft" color={statusColors[b.status]}>
                    {statusLabels[b.status]}
                  </Badge>
                  <Code size="1" variant="ghost" color="gray" title={b.commit}>
                    {b.commit.slice(0, 7)}
                  </Code>
                  <Text size="1" color="gray">
                    {b.trigger === 'pr' ? `PR #${b.pr}` : b.trigger === 'manual' ? '手动' : 'main'}
                  </Text>
                </Flex>
                <Text size="1" color="gray" className={styles.numeric}>
                  {new Date(b.createdAt).toLocaleString()}
                  {b.startedAt && ` · 用时 ${Math.max(0, Math.round(((b.endedAt ? Date.parse(b.endedAt) : clock) - Date.parse(b.startedAt)) / 1000))} 秒`}
                </Text>
                {b.error && (
                  <Text as="p" size="1" color="red" className={styles.error}>
                    {b.error}
                  </Text>
                )}
                <Flex gap="2" wrap="wrap">
                  <Button
                    size="1"
                    variant="soft"
                    color="gray"
                    onClick={() => {
                      setText('读取日志…')
                      setLog(b)
                    }}
                  >
                    <FileTextIcon />
                    查看日志
                  </Button>
                  {['queued', 'running'].includes(b.status) ? (
                    <Button size="1" variant="soft" color="red" disabled={busy} onClick={() => void act({ action: 'cancel', id: b.id })}>
                      取消
                    </Button>
                  ) : (
                    <Button size="1" variant="soft" color="gray" disabled={busy} onClick={() => void act({ action: 'retry', id: b.id })}>
                      <ReloadIcon />
                      重新构建
                    </Button>
                  )}
                </Flex>
                {data.mode === 'real' && b.target === 'ios-adhoc' && b.status === 'success' && (
                  <Flex align="center" gap="2" wrap="wrap">
                    <Button size="1" disabled={busy} onClick={() => void install(b.id)}>
                      <MobileIcon />
                      在 iPhone / iPad 上安装
                    </Button>
                    <Text size="1" color="gray">
                      仅限描述文件内已注册的设备，安装链接有效期 24 小时
                    </Text>
                  </Flex>
                )}
                {b.artifacts.map((a) => (
                  <Link key={a.name} size="2" href={`${base}/${b.id}/artifacts/${encodeURIComponent(a.name)}`} download title={`SHA-256: ${a.sha256}`} className={styles.artifact}>
                    <DownloadIcon />
                    {a.name} · {(a.size / 1024 / 1024).toFixed(1)} MB
                  </Link>
                ))}
              </article>
            </Card>
          ))
      )}
      {log && (
        <section className={styles.log} aria-label="构建日志">
          <header className={styles.logHeader}>
            <Text size="2" weight="medium" className={styles.logTitle}>
              {targetLabels[log.target]} · {log.commit.slice(0, 7)}
            </Text>
            <Button asChild size="1" variant="soft" color="gray">
              <a href={`${base}/${log.id}/log?download=1`} download>
                <DownloadIcon />
                下载完整日志
              </a>
            </Button>
            <Button size="1" variant="soft" color="gray" onClick={() => setLog(undefined)}>
              关闭日志
            </Button>
          </header>
          <pre className={styles.logText}>{text}</pre>
        </section>
      )}
    </section>
  )
}
