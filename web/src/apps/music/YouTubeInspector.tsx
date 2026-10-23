import { VideoIcon } from '@primer/octicons-react'
import { useSyncExternalStore } from 'react'
import { youtubePreview } from './youtube.ts'
import { Button } from '../../ui/Button.tsx'

export function YouTubeInspector() {
  const visible = useSyncExternalStore(youtubePreview.subscribe, youtubePreview.getSnapshot)
  return <Button size="small" variant="invisible" leadingVisual={VideoIcon} onClick={() => youtubePreview.setVisible(!visible)}>{visible ? '关闭视频预览' : '视频预览'}</Button>
}
