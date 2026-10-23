import { Button, Callout, Card, Code, Flex, Heading, Link, Text } from '@radix-ui/themes'
import { useEffect, useState } from 'react'
import { Alert } from '../../../ui/Alert.tsx'
import { CheckIcon, ExternalLinkIcon } from '../../../ui/icons.ts'
import { Spinner } from '../../../ui/Spinner.tsx'
import { cancelCodexLogin, codexLoginStatus, startCodexLogin } from './api.ts'
import styles from '../Login.module.css'

type Step = { name: 'starting' } | { name: 'waiting'; id: string; url: string; code: string } | { name: 'done' } | { name: 'failed'; error: string }

// 等用户授权时多久问一次结果
const pollInterval = 2000

// 在网页上重新登录 Codex（后端见 codex/login.ts）：打开网址、输入一次性的码，授权后这里自己变成登录好了。
// 挂上就开始，onClose 关上（没完成时顺便取消这次登录）
export function CodexLogin({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>({ name: 'starting' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    let id: string | undefined
    let timer: number | undefined
    const poll = async () => {
      const result = id && (await codexLoginStatus(id))
      if (cancelled || !result) {
        timer = window.setTimeout(() => void poll(), pollInterval)
        return
      }
      if (result.status === 'waiting') {
        timer = window.setTimeout(() => void poll(), pollInterval)
        return
      }
      id = undefined
      setStep('error' in result ? { name: 'failed', error: result.error } : { name: 'done' })
    }
    void startCodexLogin().then((result) => {
      if (cancelled) {
        if ('id' in result) {
          void cancelCodexLogin(result.id)
        }
        return
      }
      if ('id' in result) {
        id = result.id
        setStep({ name: 'waiting', ...result })
        timer = window.setTimeout(() => void poll(), pollInterval)
      } else {
        setStep({ name: 'failed', error: result.error })
      }
    })
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      if (id) {
        void cancelCodexLogin(id)
      }
    }
  }, [attempt])

  return (
    <Card size="2" className={styles.flow}>
      <Flex direction="column" gap="3">
        <Heading as="h3" size="3">
          重新登录 Codex
        </Heading>
        {step.name === 'starting' && (
          <Flex align="center" gap="2">
            <Spinner />
            <Text size="2" color="gray">
              正在拿登录码
            </Text>
          </Flex>
        )}
        {step.name === 'waiting' && (
          <>
            <Text size="2">
              1.{' '}
              <Link href={step.url} target="_blank" rel="noreferrer" underline="always">
                打开登录页面
                <ExternalLinkIcon className={styles.linkIcon} />
              </Link>
              ，用 ChatGPT 账号登录
            </Text>
            <Flex direction="column" align="start" gap="2">
              <Text size="2">2. 输入这个一次性的码（15 分钟内有效）</Text>
              <Code size="6" variant="soft" weight="bold" className={styles.deviceCode}>
                {step.code}
              </Code>
            </Flex>
            <Flex align="center" gap="2">
              <Spinner />
              <Text size="2" color="gray">
                等你授权，授权后这里会自动更新
              </Text>
            </Flex>
            <Flex justify="end" gap="2">
              <Button type="button" variant="soft" color="gray" onClick={onClose}>
                取消
              </Button>
            </Flex>
          </>
        )}
        {step.name === 'done' && (
          <>
            <Callout.Root color="green" size="1">
              <Callout.Icon>
                <CheckIcon />
              </Callout.Icon>
              <Callout.Text>登录好了，下一轮回答起用新的登录</Callout.Text>
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
              <Button type="button" onClick={() => (setStep({ name: 'starting' }), setAttempt(attempt + 1))}>
                重新开始
              </Button>
            </Flex>
          </>
        )}
      </Flex>
    </Card>
  )
}
