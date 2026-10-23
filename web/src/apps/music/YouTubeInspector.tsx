import { useSyncExternalStore } from 'react'
import { youtubePreview } from './youtube.ts'
import { Button } from '../../ui/Button.tsx'

export function YouTubeInspector() {
  const visible = useSyncExternalStore(youtubePreview.subscribe, youtubePreview.getSnapshot)
  return <Button variant="text" size="xs" onClick={() => youtubePreview.setVisible(!visible)}>{visible ? '关闭视频预览' : '视频预览'}</Button>
}
