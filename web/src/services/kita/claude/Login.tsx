import { Button, Callout, Card, Flex, Heading, Link, Text, TextField } from '@radix-ui/themes'
import { useEffect, useRef, useState } from 'react'
import { Alert } from '../../../ui/Alert.tsx'
import { CheckIcon, ExternalLinkIcon } from '../../../ui/icons.ts'
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
    <Card size="2" className={styles.flow}>
      <Flex direction="column" gap="3">
        <Heading as="h3" size="3">
          {titles[kind]}
        </Heading>
        {step.name === 'starting' && (
          <Flex align="center" gap="2">
            <Spinner />
            <Text size="2" color="gray">
              正在拿授权链接
            </Text>
          </Flex>
        )}
        {(step.name === 'code' || step.name === 'finishing') && (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            <Flex direction="column" gap="3">
              <Text size="2">
                1.{' '}
                <Link href={step.url} target="_blank" rel="noreferrer" underline="always">
                  打开授权页面
                  <ExternalLinkIcon className={styles.linkIcon} />
                </Link>
                ，用 Claude 账号授权
              </Text>
              <Flex asChild direction="column" gap="2">
                <label>
                  <Text size="2">2. 把授权后页面上显示的代码贴到这里</Text>
                  <TextField.Root
                    size="2"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="授权代码"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={step.name === 'finishing'}
                    className={styles.code}
                  />
                </label>
              </Flex>
              <Flex justify="end" gap="2">
                <Button type="button" variant="soft" color="gray" onClick={onClose}>
                  取消
                </Button>
                <Button type="submit" disabled={!code.trim()} loading={step.name === 'finishing'}>
                  完成
                </Button>
              </Flex>
            </Flex>
          </form>
        )}
        {step.name === 'done' && (
          <>
            <Callout.Root color="green" size="1">
              <Callout.Icon>
                <CheckIcon />
              </Callout.Icon>
              <Callout.Text>{kind === 'login' ? '登录好了，下一轮回答起用新的登录' : '备用 token 存好了'}</Callout.Text>
            </Callout.Root>
            <Flex justify="end" gap="2">
              <Button type="button" onClick={onClose}>
                好
              </Button>
            </Flex>
          </>
        )}
        {step.name === 'failed' && (
          <>
            <Alert>{step.error}</Alert>
            <Flex justify="end" gap="2">
              <Button type="button" variant="soft" color="gray" onClick={onClose}>
                关上
              </Button>
              <Button type="button" onClick={restart}>
                重新开始
              </Button>
            </Flex>
          </>
        )}
      </Flex>
    </Card>
  )
}
