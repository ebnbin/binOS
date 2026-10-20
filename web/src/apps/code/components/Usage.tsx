import type { SessionSummary } from '@binos/server/apps/code/types'
import { useEffect, useRef, useState } from 'react'
import { formatQuota, formatTokens } from '../format.ts'
import styles from './Usage.module.css'

// 输入框里的上下文圆环：圈是上下文占了多少，快满时 Claude Code 会压缩历史，前面的细节可能丢失。
// 点开是这个会话的用量：上下文、一共用掉的 token 和各部分、大约占订阅周额度多少
export function Usage({ session }: { session: SessionSummary }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) {
      return
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])
  const { context, tokens, quota } = session
  const ratio = context ? Math.min(context.tokens / context.window, 1) : 0
  const level = ratio >= 0.9 ? 'danger' : ratio >= 0.7 ? 'warning' : undefined
  const total = tokens && tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite
  const circumference = 2 * Math.PI * 8
  return (
    <div ref={ref} className={styles.usage}>
      <button
        type="button"
        className={styles.ring}
        data-level={level}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="用量"
        title={context ? `上下文 ${Math.round(ratio * 100)}%` : '用量'}
      >
        <svg viewBox="0 0 20 20" width={18} height={18} aria-hidden>
          <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
          <circle
            cx="10"
            cy="10"
            r="8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratio)}
          />
        </svg>
      </button>
      {open && (
        <div className={styles.panel}>
          <div className={styles.line}>
            <span className={styles.label}>上下文</span>
            {context ? (
              <span>
                {formatTokens(context.tokens)} / {formatTokens(context.window)}
                <span className={styles.muted}> · {Math.round(ratio * 100)}%</span>
              </span>
            ) : (
              <span className={styles.muted}>答完第一轮后显示</span>
            )}
          </div>
          {context && (
            <div className={styles.bar} data-level={level}>
              <span style={{ width: `${ratio * 100}%` }} />
            </div>
          )}
          <div className={styles.line}>
            <span className={styles.label}>本会话</span>
            <span>{total === undefined ? <span className={styles.muted}>还没有记录</span> : `${formatTokens(total)} token`}</span>
          </div>
          {/* 每次请求都要把整个上下文再读一遍，所以读缓存占了绝大部分 */}
          {tokens && (
            <div className={styles.parts}>
              <span>输入 {formatTokens(tokens.input)}</span>
              <span>读缓存 {formatTokens(tokens.cacheRead)}</span>
              <span>写缓存 {formatTokens(tokens.cacheWrite)}</span>
              <span>输出 {formatTokens(tokens.output)}</span>
            </div>
          )}
          {session.provider === 'claude' && (
            <div className={styles.line}>
              <span className={styles.label}>约占周额度</span>
              {quota !== undefined ? (
                <span>{formatQuota(quota)}</span>
              ) : (
                <span className={styles.muted}>7 天额度用到 20% 后才估得出来</span>
              )}
            </div>
          )}
          {quota !== undefined && <p className={styles.note}>按 API 价格折算估计；同一个订阅在别处也用时偏高</p>}
        </div>
      )}
    </div>
  )
}
