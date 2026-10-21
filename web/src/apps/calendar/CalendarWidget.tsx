import { Button, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from '@fluentui/react-components'
import { ChevronLeftRegular as ChevronLeft, ChevronRightRegular as ChevronRight } from '@fluentui/react-icons'
import { useEffect, useState } from 'react'
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
      <header className={styles.header}>
        <h2 aria-live="polite">{monthLabel.format(month)}</h2>
        <div className={styles.actions}>
          <Button
            size="small"
            icon={<ChevronLeft fontSize={16} />}
            appearance="subtle"
            type="button"
            aria-label="上一月"
            onClick={() => move(-1)}
          />
          <Button
            size="small"
            appearance="subtle"
            type="button"
            onClick={() => {
              const now = new Date()
              setToday(now)
              setMonth(new Date(now.getFullYear(), now.getMonth(), 1))
            }}
          >
            今天
          </Button>
          <Button
            size="small"
            icon={<ChevronRight fontSize={16} />}
            appearance="subtle"
            type="button"
            aria-label="下一月"
            onClick={() => move(1)}
          />
        </div>
      </header>
      <Table size="small" className={styles.month} aria-label={monthLabel.format(month)}>
        <TableHeader>
          <TableRow>
            {weekdays.map((day) => (
              <TableHeaderCell key={day} scope="col">
                {day}
              </TableHeaderCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 6 }, (_, week) => (
            <TableRow key={week}>
              {days.slice(week * 7, week * 7 + 7).map((date) => {
                const current = date.toDateString() === today.toDateString()
                return (
                  <TableCell key={date.getTime()} data-outside={date.getMonth() !== index}>
                    <span aria-label={dateLabel.format(date)} aria-current={current ? 'date' : undefined}>
                      {date.getDate()}
                    </span>
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}
