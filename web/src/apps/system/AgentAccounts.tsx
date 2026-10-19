import { agents } from '@binos/server/services/agent/types'
import type { AgentAccount, Limits } from '@binos/server/services/agent/types'
import { ChevronLeft, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useStateValue } from '../../state.ts'
import { IconButton } from '../../ui/IconButton.tsx'
import { Spinner } from '../../ui/Spinner.tsx'
import { agentAccounts } from '../../services/agent/api.ts'
import { current, formatReset, level, windowsOf } from '../../services/agent/quota.ts'
import styles from './AgentAccounts.module.css'

const dateTime = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

const planNames: Record<string, string> = { max: 'Max', pro: 'Pro', prolite: 'Pro Lite', plus: 'Plus', team: 'Team', enterprise: 'Enterprise', free: 'Free' }

// 离现在多久：3 小时后、2 天前
function relative(iso: string) {
  const minutes = Math.round((Date.parse(iso) - Date.now()) / 60_000)
  const amount = Math.abs(minutes)
  const text = amount < 60 ? `${amount} 分钟` : amount < 48 * 60 ? `${Math.round(amount / 60)} 小时` : `${Math.round(amount / 60 / 24)} 天`
  return minutes >= 0 ? `${text}后` : `${text}前`
}

const formatTime = (iso: string) => `${dateTime.format(new Date(iso))}（${relative(iso)}）`

// 各个 agent 的账号、登录凭证、额度和用量。打开时现查，令牌本身不经过页面
export function AgentAccounts({ back }: { back: () => void }) {
  // loadedAt：读到的时间，判断令牌是否已过期以它为准
  const [result, setResult] = useState<{ accounts: AgentAccount[] | null; loadedAt: number }>()
  const [loading, setLoading] = useState(true)
  const load = useCallback(
    () =>
      void agentAccounts().then((accounts) => {
        setResult({ accounts: accounts ?? null, loadedAt: Date.now() })
        setLoading(false)
      }),
    [],
  )
  useEffect(load, [load])
  const refresh = () => {
    setLoading(true)
    load()
  }
  const accounts = result?.accounts

  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <IconButton icon={ChevronLeft} label="返回" onClick={back} />
        <h1>Agent</h1>
        <IconButton icon={RefreshCw} label="重新读取" onClick={refresh} disabled={loading} className={loading ? styles.spinning : undefined} />
      </header>
      {accounts === undefined ? (
        <div className={styles.loading}>
          <Spinner />
        </div>
      ) : accounts === null ? (
        <p className={styles.failed}>没能读取 agent 的信息</p>
      ) : (
        accounts.map((account) => <Account key={account.provider} account={account} loadedAt={result!.loadedAt} />)
      )}
    </div>
  )
}

function Account({ account, loadedAt }: { account: AgentAccount; loadedAt: number }) {
  const limits = useStateValue(agents[account.provider].limitsKey) as Limits | null
  const { token } = account
  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h2>{agents[account.provider].name}</h2>
        <span className={styles.status} data-ok={account.loggedIn}>
          {account.version === undefined ? '没有安装' : account.loggedIn ? '已登录' : '没有登录'}
        </span>
        {account.version && <span className={styles.version}>{account.version}</span>}
      </header>
      <dl className={styles.list}>
        {account.email && <Row label="账号">{account.email}</Row>}
        {account.organization && <Row label="组织">{account.organization}</Row>}
        {account.plan && <Row label="套餐">{planNames[account.plan] ?? account.plan}</Row>}
        {token && (
          <Row label="访问令牌">
            <span>
              {token.expiresAt ? (
                <span data-expired={Date.parse(token.expiresAt) <= loadedAt}>{formatTime(token.expiresAt)}过期</span>
              ) : (
                '过期时间未知'
              )}
              <span className={styles.note}>{token.refreshable ? '有刷新令牌，到期前自动续期' : '没有刷新令牌，过期后要重新登录'}</span>
            </span>
          </Row>
        )}
        {token?.refreshedAt && <Row label="上次续期">{formatTime(token.refreshedAt)}</Row>}
        {limits && <QuotaRows limits={limits} />}
        {account.resetCredits && (
          <Row label="额度重置">
            <span>
              还能重置 {account.resetCredits.count} 次
              {account.resetCredits.expiresAt && <span className={styles.note}>最早一次 {formatTime(account.resetCredits.expiresAt)}过期</span>}
            </span>
          </Row>
        )}
        <Row label="正在运行">{account.running} 个</Row>
        <Row label="配置目录">
          <span className={styles.mono}>{account.configDir}</span>
        </Row>
      </dl>
    </section>
  )
}

function QuotaRows({ limits }: { limits: Limits }) {
  const limited = limits.status !== 'allowed'
  return (
    <>
      {windowsOf(limits).map(({ name, window }) => (
        <Row key={name} label={`${name}额度`}>
          <span className={styles.quota}>
            <span className={styles.quotaLine}>
              <span>{Math.round(current(window) * 100)}%</span>
              <span className={styles.note}>{formatReset(window.resetsAt)}</span>
            </span>
            <span className={styles.meter} data-level={level(current(window), limited)}>
              <span style={{ width: `${Math.min(current(window), 1) * 100}%` }} />
            </span>
          </span>
        </Row>
      ))}
      {limited && <Row label="限流">已被限流</Row>}
      <Row label="额度更新于">{formatTime(limits.updatedAt)}</Row>
    </>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
