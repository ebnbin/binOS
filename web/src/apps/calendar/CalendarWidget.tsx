import { Button, Flex, Text } from '@radix-ui/themes'
import { useEffect, useState } from 'react'
import { IconButton } from '../../ui/IconButton.tsx'
import { ChevronLeftIcon, ChevronRightIcon } from '../../ui/icons.ts'
import styles from './CalendarWidget.module.css'

const monthLabel = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' })
const dateLabel = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'full' })
const weekdays = ['一', '二', '三', '四', '五', '六', '日']

export function CalendarWidget() {
  const [today, setToday] = useState(() => new Date())
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  useEffect(() => {
    const refresh = () => setToday(new Date())
    const timer = window.setInterval(refresh, 30_000)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [])
  const year = month.getFullYear()
  const index = month.getMonth()
  const offset = (month.getDay() + 6) % 7
  const days = Array.from({ length: 42 }, (_, i) => new Date(year, index, i - offset + 1))
  const move = (delta: number) => setMonth(new Date(year, index + delta, 1))

  return (
    <section className={styles.calendar} aria-label="日历">
      <Flex asChild align="center" justify="between" gap="2">
        <header>
          <Text as="p" size="2" weight="medium" className={styles.title} aria-live="polite">{monthLabel.format(month)}</Text>
          <Flex align="center" gap="1">
            <IconButton icon={ChevronLeftIcon} label="上一月" size="1" onClick={() => move(-1)} />
            <Button type="button" size="1" variant="ghost" color="gray" className={styles.today} onClick={() => {
              const now = new Date()
              setToday(now)
              setMonth(new Date(now.getFullYear(), now.getMonth(), 1))
            }}>今天</Button>
            <IconButton icon={ChevronRightIcon} label="下一月" size="1" onClick={() => move(1)} />
          </Flex>
        </header>
      </Flex>
      <table className={styles.month} aria-label={monthLabel.format(month)}>
        <thead><tr>{weekdays.map((day) => <th key={day} scope="col">{day}</th>)}</tr></thead>
        <tbody>{Array.from({ length: 6 }, (_, week) => (
          <tr key={week}>{days.slice(week * 7, week * 7 + 7).map((date) => {
            const current = date.toDateString() === today.toDateString()
            return (
              <td key={date.getTime()} data-outside={date.getMonth() !== index}>
                <span aria-label={dateLabel.format(date)} aria-current={current ? 'date' : undefined}>{date.getDate()}</span>
              </td>
            )
          })}</tr>
        ))}</tbody>
      </table>
    </section>
  )
}
