import { embeds } from './playbackEngines.ts'

export function PlaybackInspector({ engine }: { engine?: string }) {
  const Inspector = engine ? embeds[engine]?.Inspector : undefined
  return Inspector ? <Inspector /> : null
}

