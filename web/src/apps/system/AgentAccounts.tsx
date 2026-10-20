import { agents } from '@binos/server/services/agent/types'
import type { AgentAccount, Limits } from '@binos/server/services/agent/types'
import { ChevronLeft, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { IconButton } from '../../ui/IconButton.tsx'
import { Spinner } from '../../ui/Spinner.tsx'
import { agentAccounts } from '../../services/agent/api.ts'
import type { ClaudeLoginKind } from '../../services/agent/api.ts'
import { authAttention, codexAttention, daysLeft, useClaudeAuth, useCodexAuth } from '../../services/agent/auth.ts'
import { ClaudeLogin } from '../../services/agent/ClaudeLogin.tsx'
import { CodexLogin } from '../../services/agent/CodexLogin.tsx'
import { useMinuteNow } from '../../services/agent/quota.ts'
import { QuotaWindows } from '../../services/agent/QuotaWindows.tsx'
import { useAgentStatus } from '../../services/agent/status.ts'
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
  const limits = useAgentStatus()?.limits[account.provider]
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
        {account.provider === 'claude' && <ClaudeAuthRows loadedAt={loadedAt} />}
        {account.provider === 'codex' && <CodexAuthRows />}
        {/* Claude 的访问令牌几个小时就自动续一次，要看的是上面完整登录的到期时间 */}
        {token && account.provider !== 'claude' && (
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
        {token?.refreshedAt && account.provider !== 'claude' && <Row label="上次续期">{formatTime(token.refreshedAt)}</Row>}
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

// Claude 的两份登录（见 ClaudeAuth）：正在用哪份、各自什么时候到期，可以在这里重新登录、生成备用 token
function ClaudeAuthRows({ loadedAt }: { loadedAt: number }) {
  const auth = useClaudeAuth()
  const [login, setLogin] = useState<ClaudeLoginKind>()
  if (!auth) {
    return null
  }
  const attention = authAttention(auth, loadedAt)
  const { login: full, backup } = auth
  return (
    <>
      <Row label="正在用">
        <span data-expired={auth.mode === 'none'}>{{ login: '完整登录', token: '备用 token', none: '没有能用的登录' }[auth.mode]}</span>
      </Row>
      <Row label="完整登录">
        <span>
          {!full ? (
            <span data-expired>没有</span>
          ) : full.broken ? (
            <span data-expired>已失效</span>
          ) : full.expiresAt ? (
            <span data-expired={Date.parse(full.expiresAt) <= loadedAt}>
              {Date.parse(full.expiresAt) <= loadedAt ? '已过期' : `还有 ${daysLeft(full.expiresAt, loadedAt)} 天`}
            </span>
          ) : (
            '已登录'
          )}
          <span className={styles.note}>
            {full?.expiresAt && !full.broken ? `${formatTime(full.expiresAt)}到期，之后只能重新登录` : '回答时认证失败了，重新登录后自动换回来'}
          </span>
        </span>
      </Row>
      <Row label="备用 token">
        <span>
          {backup ? (backup.expiresAt ? `还有 ${daysLeft(backup.expiresAt, loadedAt)} 天` : '已存好') : '没有'}
          <span className={styles.note}>完整登录过期或失效时自动换用，只能回答，没有 claude.ai 的连接器</span>
        </span>
      </Row>
      {attention && <p className={styles.attention} data-tone={attention.tone}>{attention.text}</p>}
      {login ? (
        <div className={styles.login}>
          <ClaudeLogin kind={login} onClose={() => setLogin(undefined)} />
        </div>
      ) : (
        <div className={styles.loginActions}>
          <button type="button" onClick={() => setLogin('login')}>
            重新登录
          </button>
          <button type="button" onClick={() => setLogin('token')}>
            {backup ? '更新备用 token' : '生成备用 token'}
          </button>
        </div>
      )}
    </>
  )
}

// Codex 的登录：回答时认证失败过就标出来，可以在这里重新登录（设备码登录）
function CodexAuthRows() {
  const auth = useCodexAuth()
  const [login, setLogin] = useState(false)
  const attention = codexAttention(auth)
  return (
    <>
      {attention && <p className={styles.attention} data-tone={attention.tone}>{attention.text}，回答时认证失败了</p>}
      {login ? (
        <div className={styles.login}>
          <CodexLogin onClose={() => setLogin(false)} />
        </div>
      ) : (
        <div className={styles.loginActions}>
          <button type="button" onClick={() => setLogin(true)}>
            {auth?.loggedIn ? '重新登录' : '登录'}
          </button>
        </div>
      )}
    </>
  )
}

function QuotaRows({ limits }: { limits: Limits }) {
  const now = useMinuteNow()
  return (
    <>
      <div className={styles.quotaWindows}>
        <QuotaWindows limits={limits} now={now} />
      </div>
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
