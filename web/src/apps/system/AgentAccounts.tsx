import { agents } from '@binos/server/services/kita/types'
import type { AgentAccount, Limits } from '@binos/server/services/kita/types'
import { Badge, Button, Callout, Card, Code, DataList, Flex, Heading, Text } from '@radix-ui/themes'
import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { agentAccounts } from '../../services/kita/api.ts'
import { useMinuteNow } from '../../services/kita/quota.ts'
import { QuotaWindows } from '../../services/kita/QuotaWindows.tsx'
import { useAgentStatus } from '../../services/kita/status.ts'
import { agentView } from '../../services/kita/views.ts'
import { IconButton } from '../../ui/IconButton.tsx'
import { ChevronLeftIcon, ExclamationTriangleIcon, InfoCircledIcon, ReloadIcon } from '../../ui/icons.ts'
import { Spinner } from '../../ui/Spinner.tsx'
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
    <div>
      <header className={styles.bar}>
        <IconButton icon={ChevronLeftIcon} label="返回" onClick={back} />
        <Heading as="h2" size="4" className={styles.title}>
          Agent
        </Heading>
        <IconButton icon={ReloadIcon} label="重新读取" onClick={refresh} loading={loading} />
      </header>
      <div className={styles.content}>
        {accounts === undefined ? (
          <Flex justify="center" p="9">
            <Spinner size="2" />
          </Flex>
        ) : accounts === null ? (
          <Callout.Root color="red" size="1" role="alert">
            <Callout.Icon>
              <ExclamationTriangleIcon />
            </Callout.Icon>
            <Callout.Text>没能读取 agent 的信息</Callout.Text>
          </Callout.Root>
        ) : (
          accounts.map((account) => <Account key={account.agent} account={account} loadedAt={result!.loadedAt} />)
        )}
      </div>
    </div>
  )
}

function Account({ account, loadedAt }: { account: AgentAccount; loadedAt: number }) {
  const status = useAgentStatus()
  const limits = status?.limits[account.agent]
  const { token } = account
  return (
    <Card size="2" asChild>
      <section>
        <Flex align="center" gap="2" wrap="wrap" mb="4">
          <Heading as="h3" size="3">
            {agents[account.agent].name}
          </Heading>
          <Badge size="1" variant="soft" color={account.version === undefined ? 'gray' : account.loggedIn ? 'green' : 'red'}>
            {account.version === undefined ? '没有安装' : account.loggedIn ? '已登录' : '没有登录'}
          </Badge>
          {account.version && (
            <Code size="1" variant="ghost" color="gray" ml="auto">
              {account.version}
            </Code>
          )}
        </Flex>
        <DataList.Root size="2">
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
            <Code size="1" variant="ghost" color="gray">
              {account.configDir}
            </Code>
          </Row>
        </DataList.Root>
      </section>
    </Card>
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
        <div className={styles.full}>
          <Callout.Root size="1" color={attention.tone === 'bad' ? 'red' : 'amber'}>
            <Callout.Icon>{attention.tone === 'bad' ? <ExclamationTriangleIcon /> : <InfoCircledIcon />}</Callout.Icon>
            <Callout.Text>{attention.text}</Callout.Text>
          </Callout.Root>
        </div>
      )}
      {fix !== undefined ? (
        <div className={styles.full}>
          <view.Login fix={fix} onClose={() => setFix(undefined)} />
        </div>
      ) : (
        actions.length > 0 && (
          <Flex gap="2" wrap="wrap" className={styles.full}>
            {actions.map((action) => (
              <Button key={action.fix} type="button" variant="soft" onClick={() => setFix(action.fix)}>
                {action.label}
              </Button>
            ))}
          </Flex>
        )
      )}
    </>
  )
}

function Value({ value, note, expired }: { value: string; note?: string; expired?: boolean }) {
  return (
    <Flex direction="column" gap="1">
      <Text color={expired ? 'red' : undefined}>{value}</Text>
      {note && (
        <Text size="1" color="gray">
          {note}
        </Text>
      )}
    </Flex>
  )
}

function QuotaRows({ limits }: { limits: Limits }) {
  const now = useMinuteNow()
  return (
    <>
      <div className={styles.full}>
        <QuotaWindows limits={limits} now={now} />
      </div>
      <Row label="额度更新于">{formatMoment(limits.updatedAt)}</Row>
    </>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DataList.Item>
      <DataList.Label minWidth="88px">{label}</DataList.Label>
      <DataList.Value>{children}</DataList.Value>
    </DataList.Item>
  )
}
