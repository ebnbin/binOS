import type { Limits } from '@binos/server/services/kita/types'
import { Callout, Progress, Text } from '@radix-ui/themes'
import { ExclamationTriangleIcon } from '../../ui/icons.ts'
import { blockingWindow, formatReset, formatSpan, windowsOf, windowState } from './quota.ts'
import styles from './Quota.module.css'

// 一个 agent 的订阅额度详情：每个窗口用了多少、多久重置，进度条上的竖线是匀速用到现在该到的位置，
// 下面一行是比匀速多用还是省、按现在的速度能不能撑到重置；被限流时先说卡在哪个窗口、什么时候恢复
export function QuotaWindows({ limits, now }: { limits: Limits; now: number }) {
  const blocking = blockingWindow(limits, now)
  return (
    <div className={styles.windows}>
      {limits.limited && (
        <Callout.Root color="red" size="1">
          <Callout.Icon>
            <ExclamationTriangleIcon />
          </Callout.Icon>
          <Callout.Text>
            {blocking
              ? `已被限流：${blocking.name}额度用满了，${formatReset(blocking.window.resetsAt, now).replace('重置', '恢复')}`
              : '已被限流'}
          </Callout.Text>
        </Callout.Root>
      )}
      {windowsOf(limits).map(({ key, longest, name, window, length }) => {
        const { used, left, expected, pace, runsOut } = windowState(window, length, now)
        const full = used >= 0.95
        return (
          <div key={key} className={styles.window} data-longest={longest || undefined}>
            <div className={styles.windowLine}>
              <Text size="2" weight="medium" className={styles.windowName}>
                <span className={styles.swatch} />
                {name}
              </Text>
              <Text size="1">{Math.round(used * 100)}%</Text>
              <Text size="1" color="gray">
                {formatReset(window.resetsAt, now)}
              </Text>
            </div>
            <div className={styles.bar}>
              <Progress size="2" variant="soft" color={full ? 'red' : longest ? 'amber' : 'green'} value={used * 100} />
              {left !== undefined && <i style={{ left: `${expected * 100}%` }} title="匀速用到现在该到的位置" />}
            </div>
            {left !== undefined && (
              <div className={styles.windowLine}>
                <Text size="1" color="gray">
                  {pace > 0.005 ? `比匀速多用 ${Math.round(pace * 100)}%` : `比匀速省 ${Math.round(-pace * 100)}%`}
                </Text>
                <Text size="1" color={runsOut === undefined ? 'gray' : 'red'}>
                  {runsOut === undefined ? '够用到重置' : runsOut === 0 ? '已经用完' : `按现在的速度 ${formatSpan(runsOut)}后用完`}
                </Text>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
