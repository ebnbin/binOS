import { useEffect, useId, useState } from 'react'
import { CodeBlock } from './CodeBlock.tsx'
import styles from './Mermaid.module.css'

// 回复还在写的时候代码一直在变，停一会儿再画
const settleDelay = 300

// Mermaid 的 base 主题按 M3 的颜色角色取色，深浅色跟随系统
function themeVariables() {
  const style = getComputedStyle(document.documentElement)
  const color = (role: string) => style.getPropertyValue(`--md-sys-color-${role}`).trim()
  return {
    darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
    fontFamily: style.getPropertyValue('--md-ref-typeface-plain').trim(),
    background: color('surface'),
    primaryColor: color('secondary-container'),
    primaryTextColor: color('on-secondary-container'),
    primaryBorderColor: color('outline'),
    secondaryColor: color('tertiary-container'),
    secondaryTextColor: color('on-tertiary-container'),
    secondaryBorderColor: color('outline'),
    tertiaryColor: color('surface-container-high'),
    tertiaryTextColor: color('on-surface'),
    tertiaryBorderColor: color('outline-variant'),
    lineColor: color('outline'),
    textColor: color('on-surface'),
    noteBkgColor: color('surface-container-highest'),
    noteTextColor: color('on-surface'),
    noteBorderColor: color('outline-variant'),
  }
}

// Mermaid 图：用到时才加载；还没画好、或者画不出来（比如还没写完）时显示代码
export function Mermaid({ code }: { code: string }) {
  const id = `mermaid-${useId().replace(/\W/g, '')}`
  const [result, setResult] = useState<{ code: string; svg: string }>()
  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const { default: mermaid } = await import('mermaid')
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', themeVariables: themeVariables() })
        if (!(await mermaid.parse(code, { suppressErrors: true }))) {
          return
        }
        const { svg } = await mermaid.render(id, code)
        if (!cancelled) {
          setResult({ code, svg })
        }
      } catch {
        // 画不出来就显示代码
      }
    }, settleDelay)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [code, id])
  if (result?.code !== code) {
    return <CodeBlock code={code} label="mermaid" />
  }
  // securityLevel 为 strict 时 Mermaid 会清理图里的内容
  return <div className={styles.diagram} dangerouslySetInnerHTML={{ __html: result.svg }} />
}
