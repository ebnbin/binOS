import { useEffect, useState } from 'react'
import { useAgentStatus } from '../status.ts'
import { claudeAccounts, selectClaudeAccount } from './api.ts'
import { ClaudeLogin } from './Login.tsx'
import styles from '../Login.module.css'

export function ClaudeAccounts() {
  const status = useAgentStatus()
  const [accounts, setAccounts] = useState<Awaited<ReturnType<typeof claudeAccounts>>>()
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)
  const [authorizing, setAuthorizing] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let cancelled = false
    void claudeAccounts().then((value) => {
      if (!cancelled) setAccounts(value)
    }).catch(() => {
      if (!cancelled) setError('没能读取账号')
    })
    return () => { cancelled = true }
  }, [status, revision])

  async function select(name: string) {
    setBusy(true)
    setError('')
    try {
      await selectClaudeAccount(name)
      setRevision((value) => value + 1)
    } catch (error) {
      setError(error instanceof Error ? error.message : '切换失败')
    } finally {
      setBusy(false)
    }
  }

  function closeLogin() {
    setAuthorizing(undefined)
    setAdding(false)
    setRevision((value) => value + 1)
  }

  return (
    <div className={styles.flow}>
      <label className={styles.codeLabel}>
        使用账号
        <select aria-label="Claude 账号" value={accounts?.active ?? 'main'} disabled={busy || !accounts} onChange={(event) => void select(event.target.value)}>
          {accounts?.accounts.map((account) => (
            <option key={account.name} value={account.name} disabled={!account.available}>
              {account.name === 'main' ? '主账号' : account.name}{!account.available ? '（令牌不可用）' : ''}
            </option>
          ))}
        </select>
      </label>
      <p>切换对所有 Claude 会话的下一轮回答生效，正在进行的回答继续使用原账号。</p>
      {authorizing ? (
        <ClaudeLogin kind="token" account={authorizing} onClose={closeLogin} />
      ) : adding ? (
        <form className={styles.steps} onSubmit={(event) => { event.preventDefault(); setAuthorizing(name) }}>
          <label className={styles.codeLabel}>
            账号名
            <input aria-label="账号名" value={name} onChange={(event) => setName(event.target.value)} pattern="[a-z0-9][a-z0-9-]{0,31}" maxLength={32} required autoComplete="off" placeholder="例如 personal" />
          </label>
          <p>同名授权会更新该账号。新增账号使用长期 token，不支持 claude.ai 连接器。</p>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => setAdding(false)}>取消</button>
            <button type="submit" className={styles.primary} disabled={name === 'main'}>开始授权</button>
          </div>
        </form>
      ) : (
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={() => setAdding(true)}>添加或更新账号</button>
        </div>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
