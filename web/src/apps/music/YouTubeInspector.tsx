import { useSyncExternalStore } from 'react'
import { ActionButton } from '../../ui/ActionButton.tsx'
import { youtubePreview } from './youtube.ts'

export function YouTubeInspector() {
  const visible = useSyncExternalStore(youtubePreview.subscribe, youtubePreview.getSnapshot)
  return <ActionButton size="S" quiet onClick={() => youtubePreview.setVisible(!visible)}>{visible ? '关闭视频预览' : '视频预览'}</ActionButton>
}
