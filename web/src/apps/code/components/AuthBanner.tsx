import { CircleAlert } from 'lucide-react'
import { useState } from 'react'
import { authAttention, codexAttention, useClaudeAuth, useCodexAuth, useHourlyNow } from '../../../services/agent/auth.ts'
import type { LoginFix } from '../../../services/agent/auth.ts'
import { ClaudeLogin } from '../../../services/agent/ClaudeLogin.tsx'
import { CodexLogin } from '../../../services/agent/CodexLogin.tsx'
import styles from './AuthBanner.module.css'

// agent 的登录要处理时（Claude 快到期、失效了、在用备用 token，Codex 失效了），列表上面一条提醒，点了就地登录。
// 两个都要处理时先处理 Claude 的
export function AuthBanner() {
  const claude = useClaudeAuth()
  const codex = useCodexAuth()
  const attention = authAttention(claude, useHourlyNow()) ?? codexAttention(codex)
  // 正在做的登录：登录好了提醒就没了，登录的过程还要留着显示结果
  const [open, setOpen] = useState<LoginFix>()
  if (!attention && !open) {
    return null
  }
  return (
    <div className={styles.banner} data-tone={attention?.tone}>
      {open === 'codex' ? (
        <CodexLogin onClose={() => setOpen(undefined)} />
      ) : open ? (
        <ClaudeLogin kind={open} onClose={() => setOpen(undefined)} />
      ) : (
        <button type="button" className={styles.row} onClick={() => setOpen(attention?.fix)}>
          <CircleAlert size={15} strokeWidth={1.75} />
          <span>{attention?.text}</span>
          <span className={styles.action}>{attention?.fix === 'token' ? '更新' : '重新登录'}</span>
        </button>
      )}
    </div>
  )
}
