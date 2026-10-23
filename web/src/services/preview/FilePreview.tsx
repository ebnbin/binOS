import { Button, DataList, Flex, Heading, IconButton, SegmentedControl, Spinner, Text } from '@radix-ui/themes'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ModalHost } from '../../shell/hosts/ModalHost.tsx'
import { CodeBlock } from '../../ui/content/CodeBlock.tsx'
import { Markdown } from '../../ui/content/Markdown.tsx'
import { languageOf } from '../../ui/content/highlight.ts'
import { Cross2Icon, DownloadIcon, FileIcon, InfoCircledIcon } from '../../ui/icons.ts'
import styles from './FilePreview.module.css'
import { extension, kind } from './kind.ts'
import type { PreviewFile } from './types.ts'

type Metadata = { size: number; modified: string; type: string }
function sizeLabel(size: number) {
  return size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`
}

function Status({ children }: { children: ReactNode }) {
  return (
    <Flex direction="column" align="center" gap="3" p="8" className={styles.status}>
      {children}
    </Flex>
  )
}

function Preview({ item, type, source }: { item: PreviewFile; type: string; source: boolean }) {
  const [text, setText] = useState<string>()
  const [error, setError] = useState('')
  const url = item.url
  useEffect(() => {
    if (!['text', 'markdown', 'html'].includes(type)) return
    const controller = new AbortController()
    void (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal, headers: { Range: 'bytes=0-1048576' } })
        if (!response.ok) throw new Error('文件加载失败')
        const content = await response.text()
        if (content.length > 1_048_576 || Number(response.headers.get('Content-Range')?.split('/')[1] ?? response.headers.get('Content-Length')) > 1_048_576) {
          throw new Error('文件超过 1 MB 预览上限，请下载查看')
        }
        setText(content)
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '文件加载失败')
      }
    })()
    return () => controller.abort()
  }, [url, type])
  if (error) return <Status><Text size="2" color="gray">{error}</Text></Status>
  if (type === 'image') return <img className={styles.image} src={url} alt={item.name} onError={() => setError('此图片无法预览，请下载查看')} />
  if (type === 'video') return <video className={styles.media} controls src={url} onError={() => setError('此视频无法在浏览器中播放，请下载查看')} />
  if (type === 'audio') return <audio className={styles.media} controls src={url} onError={() => setError('此音频无法在浏览器中播放，请下载查看')} />
  if (type === 'pdf') return <iframe className={styles.document} title={item.name} src={url} />
  if (type === 'binary') {
    return (
      <Status>
        <FileIcon width={48} height={48} className={styles.statusIcon} />
        <Text size="3" weight="medium">{item.name}</Text>
        <Text size="2" color="gray">此文件暂不支持预览<br />可以下载原文件或查看文件信息</Text>
      </Status>
    )
  }
  if (text === undefined) return <Status><Spinner size="3" /><Text size="2" color="gray">加载中…</Text></Status>
  if (type === 'html' && !source) return <iframe className={styles.document} title={item.name} sandbox="allow-scripts" srcDoc={text} />
  if (type === 'markdown' && !source) return <div className={styles.prose}><Markdown text={text} /></div>
  return <div className={styles.code}><CodeBlock code={text} lang={languageOf(item.name)} startLine={1} label={item.name} /></div>
}

export function FilePreview(props: { item: PreviewFile; close: () => void }) {
  return <PreviewDialog key={props.item.url + '\0' + props.item.name} {...props} />
}

function PreviewDialog({ item, close }: { item: PreviewFile; close: () => void }) {
  const [info, setInfo] = useState(false)
  const [source, setSource] = useState(false)
  const [metadata, setMetadata] = useState<Metadata>()
  const [error, setError] = useState(false)
  const type = kind(item.name)
  useEffect(() => {
    if (!item.infoUrl) return
    const controller = new AbortController()
    fetch(item.infoUrl, { signal: controller.signal })
      .then(async (res) => { if (!res.ok) throw new Error(); setMetadata(await res.json() as Metadata) })
      .catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [item.infoUrl])
  return (
    <ModalHost className={styles.dialog} size="1" maxWidth="1160px" onClose={close} label={item.name}>
      <header className={styles.toolbar}>
        <FileIcon className={styles.icon} />
        <Text size="2" weight="medium" truncate className={styles.title}>{item.name}</Text>
        {['markdown', 'html'].includes(type) && (
          <SegmentedControl.Root size="1" value={source ? 'source' : 'preview'} onValueChange={(value) => setSource(value === 'source')}>
            <SegmentedControl.Item value="preview">预览</SegmentedControl.Item>
            <SegmentedControl.Item value="source">源码</SegmentedControl.Item>
          </SegmentedControl.Root>
        )}
        <Button asChild size="1" variant="soft" color="gray">
          <a href={item.downloadUrl ?? item.url} download={item.name} title="下载">
            <DownloadIcon />
            <span className={styles.downloadLabel}>下载</span>
          </a>
        </Button>
        <IconButton type="button" size="1" variant={info ? 'soft' : 'ghost'} color="gray" onClick={() => setInfo(!info)} aria-label="文件信息" title="文件信息" aria-pressed={info}>
          <InfoCircledIcon />
        </IconButton>
        <IconButton type="button" size="1" variant="ghost" color="gray" onClick={close} aria-label="关闭预览" title="关闭预览" autoFocus>
          <Cross2Icon />
        </IconButton>
      </header>
      <div className={styles.body}>
        <main className={styles.preview}><Preview item={item} type={type} source={source} /></main>
        {info && (
          <aside className={styles.info}>
            <Heading as="h3" size="3" mb="4">文件信息</Heading>
            <DataList.Root orientation="vertical" size="2">
              <DataList.Item>
                <DataList.Label>名称</DataList.Label>
                <DataList.Value className={styles.value}>{item.name}</DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>类型</DataList.Label>
                <DataList.Value className={styles.value}>
                  {extension(item.name).toUpperCase() || '文件'}
                  {metadata && <Text size="1" color="gray">{metadata.type}</Text>}
                </DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>大小</DataList.Label>
                <DataList.Value className={styles.value}>
                  {metadata ? `${sizeLabel(metadata.size)}（${metadata.size.toLocaleString()} 字节）` : !item.infoUrl ? '—' : error ? '读取失败' : '加载中…'}
                </DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>修改时间</DataList.Label>
                <DataList.Value className={styles.value}>{metadata ? new Date(metadata.modified).toLocaleString() : '—'}</DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>来源</DataList.Label>
                <DataList.Value className={styles.value}>{item.source ?? '—'}</DataList.Value>
              </DataList.Item>
              {item.path && (
                <DataList.Item>
                  <DataList.Label>原始路径</DataList.Label>
                  <DataList.Value className={styles.value}>{item.path}</DataList.Value>
                </DataList.Item>
              )}
            </DataList.Root>
          </aside>
        )}
      </div>
    </ModalHost>
  )
}
