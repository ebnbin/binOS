import styles from './UiIcon.module.css'

// Spectrum 2 控件里的 UI 图标（@react-spectrum/s2 没有导出），路径取自它的 S2_*Size100 图形，尺寸跟着 --ui-icon-size
const glyphs = {
  chevron: { box: 10, d: 'M7.965 5.178C7.978 5.118 8 5.061 8 5s-.021-.118-.034-.178c-.01-.05-.01-.102-.03-.15-.023-.058-.068-.107-.104-.16-.03-.042-.047-.09-.084-.127l-.004-.003-.003-.004L3.615.303a.875.875 0 1 0-1.23 1.244L5.88 5 2.385 8.453a.875.875 0 1 0 1.23 1.244L7.74 5.622l.003-.004.004-.003c.037-.038.055-.085.084-.127.036-.053.08-.102.104-.16.02-.048.02-.1.03-.15' },
  checkmark: { box: 10, d: 'M3.5 9.503c-.3 0-.584-.135-.774-.367l-2.45-3A1 1 0 1 1 1.823 4.87L3.481 6.9 8.161.888A1 1 0 0 1 9.74 2.118l-5.45 7a1 1 0 0 1-.777.385z' },
  cross: { box: 10, d: 'm6.289 5 2.922-2.923A.912.912 0 0 0 7.922.788L5 3.711 2.078.788a.912.912 0 0 0-1.29 1.29L3.712 5 .789 7.923a.912.912 0 0 0 1.289 1.289L5 6.289l2.922 2.923a.91.91 0 0 0 1.29 0 .91.91 0 0 0 0-1.29z' },
  dash: { box: 10, d: 'M8.5 6h-7a1 1 0 1 1 0-2h7a1 1 0 1 1 0 2' },
}

// direction 只对 chevron 有效，默认指向行尾
export function UiIcon({ glyph, direction, className }: { glyph: keyof typeof glyphs; direction?: 'down' | 'up' | 'left'; className?: string }) {
  const { box, d } = glyphs[glyph]
  return (
    <svg viewBox={`0 0 ${box} ${box}`} className={`${styles.icon} ${className ?? ''}`} data-direction={direction} aria-hidden focusable={false}>
      <path d={d} />
    </svg>
  )
}
