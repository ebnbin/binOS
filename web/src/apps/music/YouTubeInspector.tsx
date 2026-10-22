import { useSyncExternalStore } from 'react'
import { youtubePreview } from './youtube.ts'
import styles from './music.module.css'

export function YouTubeInspector() {
  const visible = useSyncExternalStore(youtubePreview.subscribe, youtubePreview.getSnapshot)
  return <button type="button" className={styles.textButton} onClick={() => youtubePreview.setVisible(!visible)}>{visible ? '关闭视频预览' : '视频预览'}</button>
}
