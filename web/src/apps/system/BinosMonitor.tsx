import type { MonitorStatus } from '@binos/server/apps/system/types'
import { useEffect, useState } from 'react'
import { useConnected } from '../../events.ts'
import { useApps } from '../index.ts'
import { ExternalApps } from './ExternalApps.tsx'
import { ProbeDetails, Row, Section } from './HostMonitor.tsx'
import { bytes, moment } from './format.ts'
import { systemRequest } from './monitor.ts'
import styles from './Monitor.module.css'

export function BinosMonitor({ status, navigate }: { status?: MonitorStatus; navigate(route: string): void }) {
  const connected = useConnected()
  const apps = useApps().filter((app) => app.settings)
  const snapshot = status?.snapshot
  return (
    <div className={styles.content}>
      <div className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>BINOS</span>
          <h1>运行与维护</h1>
          <p>binOS 后端、远程访问与上线管道</p>
        </div>
        <span className={styles.badge} data-tone={connected ? 'ok' : 'critical'}>
          {connected ? '浏览器已连接' : '浏览器已断开'}
        </span>
      </div>
      <Section title="当前实例">
        <dl>
          <Row label="环境">{snapshot ? (snapshot.runtime.test ? '测试 / PR 预览实例' : '正式版') : '读取中'}</Row>
          <Row label="版本">{snapshot?.runtime.version || '读取中'}</Row>
          <Row label="Node.js">{snapshot?.runtime.node || '读取中'}</Row>
          <Row label="进程 PID">{snapshot?.runtime.pid || '读取中'}</Row>
          <Row label="后端已运行">
            {snapshot ? `${Math.floor(snapshot.runtime.uptime / 3600)} 时 ${Math.floor((snapshot.runtime.uptime % 3600) / 60)} 分` : '读取中'}
          </Row>
          <Row label="后端内存 / 堆">
            {bytes(snapshot?.runtime.memory)} / {bytes(snapshot?.runtime.heap)}
          </Row>
          <Row label="数据根目录">{snapshot?.runtime.root || '读取中'}</Row>
          <Row label="上线阻止记录">{snapshot?.runtime.deploymentFailure || '未读取到失败标记'}</Row>
        </dl>
      </Section>
      <Section
        title="launchd 服务"
        hint="以下观察宿主正式版服务，测试 / 预览实例不以这些服务运行。deploy 每 60 秒执行，空闲时不运行属于正常状态。服务存活不能证明 Cloudflare 公网链路端到端可达。这些服务依赖用户登录会话；离开前需另行确认断电重启后的自动登录与网络恢复方案。"
      >
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>服务</th>
                <th>状态</th>
                <th>PID</th>
                <th>上次退出码</th>
              </tr>
            </thead>
            <tbody>
              {snapshot?.services.map((service) => (
                <tr key={service.id}>
                  <td>{service.label}</td>
                  <td className={service.error || (!service.periodic && service.state !== 'running') ? styles.bad : ''}>
                    {service.error ? '无法确认' : service.state}
                  </td>
                  <td>{service.pid ?? '—'}</td>
                  <td>{service.exitCode ?? '未报告'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {snapshot?.services
          .filter((s) => s.error)
          .map((s) => (
            <p key={s.id} className={styles.note}>
              {s.label}：{s.error}
            </p>
          ))}
      </Section>
      {status?.storageError && (
        <p role="alert" className={styles.warning}>
          {status.storageError}
        </p>
      )}
      <Logs />
      <Section title="应用设置">
        {apps.map((app) => (
          <button className={styles.settingLink} key={app.id} onClick={() => navigate(`/apps/${app.id}`)}>
            {app.name}
            <span>{app.settings!.hint}</span>
          </button>
        ))}
        {!apps.length && <p className={styles.note}>暂无应用专用设置</p>}
      </Section>
      <ExternalApps />
    </div>
  )
}
function Logs() {
  const [name, setName] = useState('server')
  const [result, setResult] = useState<{ name: string; bytes: number; modified: number; truncated: boolean; text: string }>()
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    void systemRequest<NonNullable<typeof result>>(`/logs/${name}`, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult(data)
          setError('')
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setResult(undefined)
          setError(String(e))
        }
      })
    return () => controller.abort()
  }, [name, revision])
  return (
    <Section title="服务日志" hint="读取当前实例数据目录的日志末尾，最多 64 KiB。日志可能包含私密信息；只在打开本页或手动刷新时读取。">
      <div className={styles.actions}>
        <select aria-label="服务日志" value={name} onChange={(e) => setName(e.target.value)}>
          <option value="server">Server</option>
          <option value="tunnel">Tunnel</option>
          <option value="deploy">Deploy</option>
        </select>
        <button onClick={() => setRevision((r) => r + 1)}>刷新日志</button>
      </div>
      {error && (
        <p className={styles.bad} role="alert">
          {error}
        </p>
      )}
      {result && (
        <>
          <p className={styles.note}>
            {bytes(result.bytes)} · 修改于 {moment(result.modified)}
            {result.truncated && ' · 仅显示末尾'}
          </p>
          <ProbeDetails probes={[{ id: 'log', label: result.name + '.log', text: result.text, at: result.modified }]} />
        </>
      )}
    </Section>
  )
}
