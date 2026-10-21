import { Button } from '@fluentui/react-components'
import { ChevronRightRegular as ChevronRight, DocumentBulletListRegular as FileDiff } from '@fluentui/react-icons'
import { useState } from 'react'
import { ToolBody } from './ToolBody.tsx'
import type { FileChange } from './tools.ts'
import styles from './TurnChanges.module.css'

// 目录只留最后几段
function directory(path: string) {
  const parts = path.split('/').slice(0, -1)
  return parts.length > 3 ? `…/${parts.slice(-3).join('/')}` : parts.join('/')
}

const opText = { add: '新建', delete: '删除' }

// 一轮结束时汇总这一轮改了哪些文件，点开一个文件看它的每一处修改
export function TurnChanges({ thread, files }: { thread: string; files: FileChange[] }) {
  const added = files.reduce((sum, file) => sum + file.added, 0)
  const removed = files.reduce((sum, file) => sum + file.removed, 0)
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <FileDiff fontSize={14} />
        <span>改动了 {files.length} 个文件</span>
        <Counts added={added} removed={removed} />
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
      <Button
        size="small"
        appearance="subtle"
        type="button"
        className={styles.row}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        title={file.path}
      >
        <ChevronRight fontSize={13} className={styles.chevron} />
        <span className={styles.name}>{file.path.split('/').at(-1)}</span>
        <span className={styles.dir}>{directory(file.path)}</span>
        {file.op && <span className={styles.kind}>{opText[file.op]}</span>}
        <Counts added={file.added} removed={file.removed} />
      </Button>
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
