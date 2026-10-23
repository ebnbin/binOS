import { OpenRegular } from '@fluentui/react-icons/headless/svg/open'
import { useEffect, useRef, useState } from 'react'
import { Alert } from '../../../ui/Alert.tsx'
import { Button } from '../../../ui/Button.tsx'
import { Field } from '../../../ui/Field.tsx'
import { Input } from '../../../ui/Input.tsx'
import { Spinner } from '../../../ui/Spinner.tsx'
import { cancelClaudeLogin, finishClaudeLogin, startClaudeLogin } from './api.ts'
import type { ClaudeLoginKind } from './api.ts'
import styles from '../Login.module.css'

type Step = { name: 'starting' } | { name: 'code'; id: string; url: string } | { name: 'finishing'; id: string; url: string } | { name: 'done' } | { name: 'failed'; error: string }

const titles: Record<ClaudeLoginKind, string> = { login: '重新登录 Claude', token: '生成备用 token' }

// 在网页上登录 Claude（后端见 claude/login.ts）：打开授权链接，用要登录的账号授权，把授权后页面上的代码贴回来。
// 挂上就开始，onClose 关上（没完成时顺便取消这次登录）
export function ClaudeLogin({ kind, onClose }: { kind: ClaudeLoginKind; onClose: () => void }) {
  const [step, setStep] = useState<Step>({ name: 'starting' })
  const [code, setCode] = useState('')
  const [attempt, setAttempt] = useState(0)
  const pending = useRef<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    void startClaudeLogin(kind).then((result) => {
      if (cancelled) {
        if ('id' in result) {
          void cancelClaudeLogin(result.id)
        }
        return
      }
      if ('id' in result) {
        pending.current = result.id
        setStep({ name: 'code', ...result })
      } else {
        setStep({ name: 'failed', error: result.error })
      }
    })
    return () => {
      cancelled = true
      if (pending.current) {
        void cancelClaudeLogin(pending.current)
        pending.current = undefined
      }
    }
  }, [kind, attempt])

  async function submit() {
    if (step.name !== 'code' || !code.trim()) {
      return
    }
    setStep({ ...step, name: 'finishing' })
    const result = await finishClaudeLogin(step.id, code)
    // 后端处理完就结束了这次登录，成没成功都不用再取消
    pending.current = undefined
    setStep('ok' in result ? { name: 'done' } : { name: 'failed', error: result.error })
  }

  function restart() {
    setCode('')
    setStep({ name: 'starting' })
    setAttempt(attempt + 1)
  }

  return (
    <div className={styles.flow}>
      <div className={styles.title}>{titles[kind]}</div>
      {step.name === 'starting' && (
        <p className={styles.waiting}>
          <Spinner /> 正在拿授权链接
        </p>
      )}
      {(step.name === 'code' || step.name === 'finishing') && (
        <form
          className={styles.steps}
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <a className={styles.link} href={step.url} target="_blank" rel="noreferrer">
            1. 打开授权页面，用 Claude 账号授权
            <OpenRegular className={styles.linkIcon} />
          </a>
          <Field label="2. 把授权后页面上显示的代码贴到这里">
            <Input
              className={styles.codeInput}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="授权代码"
              autoComplete="off"
              spellCheck={false}
              disabled={step.name === 'finishing'}
            />
          </Field>
          <div className={styles.actions}>
            <Button onClick={onClose}>
              取消
            </Button>
            <Button type="submit" appearance="primary" disabled={!code.trim() || step.name === 'finishing'}>
              {step.name === 'finishing' ? <Spinner /> : '完成'}
            </Button>
          </div>
        </form>
      )}
      {step.name === 'done' && (
        <>
          <Alert intent="success">{kind === 'login' ? '登录好了，下一轮回答起用新的登录' : '备用 token 存好了'}</Alert>
          <div className={styles.actions}>
            <Button appearance="primary" onClick={onClose}>
              好
            </Button>
          </div>
        </>
      )}
      {step.name === 'failed' && (
        <>
          <Alert>{step.error}</Alert>
          <div className={styles.actions}>
            <Button onClick={onClose}>
              关上
            </Button>
            <Button appearance="primary" onClick={restart}>
              重新开始
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
