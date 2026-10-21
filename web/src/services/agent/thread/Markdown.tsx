import { memo, useCallback } from 'react'
import { Markdown as ContentMarkdown } from '../../../ui/content/Markdown.tsx'
import { FileBlock } from '../../preview/index.ts'
import { threadPreviewFile } from '../files.ts'

export const Markdown = memo(function Markdown({ thread, text, files }: {
  thread: string
  text: string
  files?: Record<string, string>
}) {
  const renderFile = useCallback((reference: string, embedded: boolean) => {
    try {
      reference = decodeURI(reference)
    } catch {
      // 保留无法解码的路径
    }
    const file = files?.[reference]
    if (!file) return undefined
    const item = threadPreviewFile(thread, file, reference.split('/').at(-1) || file, reference)
    return <FileBlock item={item} embedded={embedded} />
  }, [thread, files])
  return <ContentMarkdown text={text} renderFile={renderFile} />
})
