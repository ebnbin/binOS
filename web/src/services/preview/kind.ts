export const extension = (name: string) => name.split('.').at(-1)?.toLowerCase() ?? ''
export function kind(name: string) {
  const ext = extension(name)
  if (/^(png|jpe?g|gif|webp|avif|bmp|svg)$/.test(ext)) return 'image'
  if (/^(mp4|webm|mov|m4v)$/.test(ext)) return 'video'
  if (/^(mp3|wav|ogg|m4a|flac)$/.test(ext)) return 'audio'
  if (/^(html|htm)$/.test(ext)) return 'html'
  if (ext === 'pdf') return 'pdf'
  if (/^(md|markdown)$/.test(ext)) return 'markdown'
  if (/^(txt|log|csv|tsv|json|jsonl|xml|yaml|yml|toml|ini|cfg|conf|env|js|jsx|ts|tsx|mjs|cjs|mts|cts|css|scss|less|py|rb|rs|go|java|kt|swift|c|cpp|h|hpp|sh|bash|zsh|sql|vue|svelte|tex|r|patch|diff)$/.test(ext) || /^(dockerfile|makefile|license|readme|\.gitignore)$/i.test(name)) return 'text'
  return 'binary'
}
