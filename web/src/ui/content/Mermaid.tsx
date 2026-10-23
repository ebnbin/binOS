import { useEffect, useId, useState } from 'react'
import { CodeBlock } from './CodeBlock.tsx'
import styles from './Mermaid.module.css'

// 回复还在写的时候代码一直在变，停一会儿再画
const settleDelay = 300

// Mermaid 只认颜色值，从 Primer 的 token 里取当前外观下的值；它要据此推算深浅，只用不透明的颜色
function primerTheme(element: Element) {
  const style = getComputedStyle(element)
  const token = (name: string) => style.getPropertyValue(name).trim()
  const mode = document.documentElement.dataset.colorMode
  const dark = mode === 'dark' || (mode !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  return {
    darkMode: dark,
    background: token('--bgColor-default'),
    fontFamily: token('--fontStack-sansSerif'),
    fontSize: '14px',
    primaryColor: token('--bgColor-muted'),
    primaryTextColor: token('--fgColor-default'),
    primaryBorderColor: token('--borderColor-emphasis'),
    secondaryColor: token('--bgColor-default'),
    tertiaryColor: token('--bgColor-inset'),
    lineColor: token('--fgColor-muted'),
    textColor: token('--fgColor-default'),
    noteBkgColor: token('--bgColor-muted'),
    noteBorderColor: token('--borderColor-attention-emphasis'),
    noteTextColor: token('--fgColor-default'),
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
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', themeVariables: primerTheme(document.documentElement) })
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
