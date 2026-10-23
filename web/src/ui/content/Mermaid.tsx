import { useEffect, useId, useState } from 'react'
import { CodeBlock } from './CodeBlock.tsx'
import styles from './Mermaid.module.css'

// 回复还在写的时候代码一直在变，停一会儿再画
const settleDelay = 300

// 用 GNOME 调色板和 libadwaita 的卡片、文字颜色画图。Mermaid 只认十六进制颜色，这里直接写调色板的值
const themeVariables = {
  light: {
    fontFamily: 'Adwaita Sans, sans-serif',
    background: '#ffffff',
    primaryColor: '#d4e5fa',
    primaryBorderColor: '#3584e4',
    primaryTextColor: '#323236',
    secondaryColor: '#d7f5e3',
    tertiaryColor: '#f6f5f4',
    lineColor: '#77767b',
    textColor: '#323236',
    noteBkgColor: '#fcf7b5',
    noteBorderColor: '#e5a50a',
    noteTextColor: '#323236',
  },
  dark: {
    fontFamily: 'Adwaita Sans, sans-serif',
    background: '#1d1d20',
    primaryColor: '#1a3a63',
    primaryBorderColor: '#62a0ea',
    primaryTextColor: '#ffffff',
    secondaryColor: '#1c4a37',
    tertiaryColor: '#36363a',
    lineColor: '#9a9996',
    textColor: '#ffffff',
    noteBkgColor: '#5c4a12',
    noteBorderColor: '#cd9309',
    noteTextColor: '#ffffff',
  },
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
        const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', themeVariables: { ...themeVariables[dark ? 'dark' : 'light'], darkMode: dark } })
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
