import { CircleAlert } from 'lucide-react'
import { useState } from 'react'
import { authAttention, useClaudeAuth, useHourlyNow } from '../../../services/agent/claude-auth.ts'
import { ClaudeLogin } from '../../../services/agent/ClaudeLogin.tsx'
import styles from './AuthBanner.module.css'

// Claude 的登录要处理时（快到期、失效了、在用备用 token），列表上面一条提醒，点了就地重新登录
export function AuthBanner() {
  const attention = authAttention(useClaudeAuth(), useHourlyNow())
  const [open, setOpen] = useState(false)
  if (!attention && !open) {
    return null
  }
  return (
    <div className={styles.banner} data-tone={attention?.tone}>
      {open ? (
        <ClaudeLogin kind={attention?.fix ?? 'login'} onClose={() => setOpen(false)} />
      ) : (
        <button type="button" className={styles.row} onClick={() => setOpen(true)}>
          <CircleAlert size={15} strokeWidth={1.75} />
          <span>{attention?.text}</span>
          <span className={styles.action}>{attention?.fix === 'token' ? '更新' : '重新登录'}</span>
        </button>
      )}
    </div>
  )
}
