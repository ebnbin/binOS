import { ChevronRightIcon, FileDiffIcon } from '@primer/octicons-react'
import { useState } from 'react'
import { Label } from '../../../ui/Label.tsx'
import { ToolBody } from './ToolBody.tsx'
import type { FileChange } from './tools.ts'
import styles from './TurnChanges.module.css'

// 目录只留最后几段
function directory(path: string) {
  const parts = path.split('/').slice(0, -1)
  return parts.length > 3 ? `…/${parts.slice(-3).join('/')}` : parts.join('/')
}

const ops = { add: { text: '新建', variant: 'success' }, delete: { text: '删除', variant: 'danger' } } as const

// 一轮结束时汇总这一轮改了哪些文件，点开一个文件看它的每一处修改。样子是 GitHub PR 的文件列表
export function TurnChanges({ thread, files }: { thread: string; files: FileChange[] }) {
  const added = files.reduce((sum, file) => sum + file.added, 0)
  const removed = files.reduce((sum, file) => sum + file.removed, 0)
  return (
    <div className={styles.box}>
      <div className={styles.header}>
        <FileDiffIcon size={16} className={styles.headerIcon} />
        <span className={styles.headerTitle}>改动了 {files.length} 个文件</span>
        <Counts added={added} removed={removed} />
        <DiffStat added={added} removed={removed} />
      </div>
      <ul className={styles.files}>
        {files.map((file) => (
          <FileRow key={file.path} thread={thread} file={file} />
        ))}
      </ul>
    </div>
  )
}

function FileRow({ thread, file }: { thread: string; file: FileChange }) {
  const [open, setOpen] = useState(false)
  return (
    <li data-open={open || undefined}>
      <button type="button" className={styles.row} onClick={() => setOpen(!open)} aria-expanded={open} title={file.path}>
        <ChevronRightIcon size={16} className={styles.chevron} />
        <span className={styles.name}>{file.path.split('/').at(-1)}</span>
        <span className={styles.dir}>{directory(file.path)}</span>
        {file.op && <Label variant={ops[file.op].variant}>{ops[file.op].text}</Label>}
        <Counts added={file.added} removed={file.removed} />
      </button>
      {open && (
        <div className={styles.body}>
          {file.calls.map(({ call, result }) => (
            <ToolBody key={call.id} thread={thread} call={call} result={result} />
          ))}
        </div>
      )}
    </li>
  )
}

function Counts({ added, removed }: { added: number; removed: number }) {
  return (
    <span className={styles.counts}>
      {added > 0 && <span className={styles.added}>+{added}</span>}
      {removed > 0 && <span className={styles.removed}>−{removed}</span>}
    </span>
  )
}

// GitHub 的 diffstat：五个小方块按增删的比例涂成绿和红
function DiffStat({ added, removed }: { added: number; removed: number }) {
  const total = added + removed
  const green = total ? Math.round((added / total) * 5) : 0
  const red = total ? Math.min(5 - green, Math.max(removed > 0 ? 1 : 0, Math.round((removed / total) * 5))) : 0
  return (
    <span className={styles.diffstat} aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <i key={i} data-kind={i < green ? 'added' : i < green + red ? 'removed' : undefined} />
      ))}
    </span>
  )
}
