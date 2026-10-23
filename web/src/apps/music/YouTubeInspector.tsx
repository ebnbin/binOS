import { Button } from '@radix-ui/themes'
import { useSyncExternalStore } from 'react'
import { youtubePreview } from './youtube.ts'

export function YouTubeInspector() {
  const visible = useSyncExternalStore(youtubePreview.subscribe, youtubePreview.getSnapshot)
  return <Button type="button" size="1" variant="ghost" color="gray" onClick={() => youtubePreview.setVisible(!visible)}>{visible ? '关闭视频预览' : '视频预览'}</Button>
}
