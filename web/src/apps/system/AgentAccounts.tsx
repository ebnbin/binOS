import { agents } from '@binos/server/services/kita/types'
import type { AgentAccount, Limits } from '@binos/server/services/kita/types'
import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { agentAccounts } from '../../services/kita/api.ts'
import { useMinuteNow } from '../../services/kita/quota.ts'
import { QuotaWindows } from '../../services/kita/QuotaWindows.tsx'
import { useAgentStatus } from '../../services/kita/status.ts'
import { agentView } from '../../services/kita/views.ts'
import { Button } from '../../ui/Button.tsx'
import { ChevronLeft, Refresh } from '../../ui/icons.tsx'
import { IconButton } from '../../ui/IconButton.tsx'
import { InlineAlert } from '../../ui/InlineAlert.tsx'
import { ProgressCircle } from '../../ui/ProgressCircle.tsx'
import { StatusLight } from '../../ui/StatusLight.tsx'
import { formatMoment } from '../../ui/time.ts'
import styles from './AgentAccounts.module.css'

const planNames: Record<string, string> = { max: 'Max', pro: 'Pro', prolite: 'Pro Lite', plus: 'Plus', team: 'Team', enterprise: 'Enterprise', free: 'Free' }

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
        <h2 className={styles.title}>Agent</h2>
        <IconButton icon={Refresh} label="重新读取" onClick={refresh} disabled={loading} className={loading ? styles.spinning : undefined} />
      </header>
      {accounts === undefined ? (
        <div className={styles.loading}>
          <ProgressCircle size="M" />
        </div>
      ) : accounts === null ? (
        <InlineAlert className={styles.failed}>没能读取 agent 的信息</InlineAlert>
      ) : (
        accounts.map((account) => <Account key={account.agent} account={account} loadedAt={result!.loadedAt} />)
      )}
    </div>
  )
}

function Account({ account, loadedAt }: { account: AgentAccount; loadedAt: number }) {
  const status = useAgentStatus()
  const limits = status?.limits[account.agent]
  const { token } = account
  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h3 className={styles.name}>{agents[account.agent].name}</h3>
        <StatusLight variant={account.version === undefined ? 'neutral' : account.loggedIn ? 'positive' : 'negative'}>
          {account.version === undefined ? '没有安装' : account.loggedIn ? '已登录' : '没有登录'}
        </StatusLight>
        {account.version && <span className={styles.version}>{account.version}</span>}
      </header>
      <dl className={styles.list}>
        {account.email && <Row label="账号">{account.email}</Row>}
        {account.plan && <Row label="套餐">{planNames[account.plan] ?? account.plan}</Row>}
        {account.details.map((detail) => (
          <Row key={detail.label} label={detail.label}>
            <Value value={detail.value} note={detail.note} />
          </Row>
        ))}
        <AuthRows account={account} loadedAt={loadedAt} />
        {token && (
          <Row label="访问令牌">
            <Value
              value={token.expiresAt ? `${formatMoment(token.expiresAt, loadedAt)}过期` : '过期时间未知'}
              expired={token.expiresAt !== undefined && Date.parse(token.expiresAt) <= loadedAt}
              note={token.refreshable ? '有刷新令牌，到期前自动续期' : '没有刷新令牌，过期后要重新登录'}
            />
          </Row>
        )}
        {token?.refreshedAt && <Row label="上次续期">{formatMoment(token.refreshedAt, loadedAt)}</Row>}
        {limits && <QuotaRows limits={limits} />}
        <Row label="正在运行">{account.running} 个</Row>
        <Row label="配置目录">
          <span className={styles.mono}>{account.configDir}</span>
        </Row>
      </dl>
    </section>
  )
}

// 登录相关的几行、要留意的事，和能做的登录（就地展开）；各个 agent 的登录方式不同，内容由它自己给出
function AuthRows({ account, loadedAt }: { account: AgentAccount; loadedAt: number }) {
  const view = agentView(account.agent, useAgentStatus())
  const [fix, setFix] = useState<string>()
  const attention = view.attention(loadedAt)
  const actions = view.loginActions()
  return (
    <>
      {view.authRows(loadedAt).map((row) => (
        <Row key={row.label} label={row.label}>
          <Value value={row.value} note={row.note} expired={row.expired} />
        </Row>
      ))}
      {attention && (
        <InlineAlert variant={attention.tone === 'bad' ? 'negative' : 'informative'} fillStyle="subtleFill" className={styles.attention}>
          {attention.text}
        </InlineAlert>
      )}
      {fix !== undefined ? (
        <div className={styles.login}>
          <view.Login fix={fix} onClose={() => setFix(undefined)} />
        </div>
      ) : (
        actions.length > 0 && (
          <div className={styles.loginActions}>
            {actions.map((action) => (
              <Button key={action.fix} variant="secondary" onClick={() => setFix(action.fix)}>
                {action.label}
              </Button>
            ))}
          </div>
        )
      )}
    </>
  )
}

function Value({ value, note, expired }: { value: string; note?: string; expired?: boolean }) {
  return (
    <span>
      <span data-expired={expired || undefined}>{value}</span>
      {note && <span className={styles.note}>{note}</span>}
    </span>
  )
}

function QuotaRows({ limits }: { limits: Limits }) {
  const now = useMinuteNow()
  return (
    <>
      <div className={styles.quotaWindows}>
        <QuotaWindows limits={limits} now={now} />
      </div>
      <Row label="额度更新于">{formatMoment(limits.updatedAt)}</Row>
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
