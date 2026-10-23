import { useEffect, useId, useState } from 'react'
import { CodeBlock } from './CodeBlock.tsx'
import styles from './Mermaid.module.css'

// 回复还在写的时候代码一直在变，停一会儿再画
const settleDelay = 300

// Mermaid 图：用到时才加载；还没画好、或者画不出来（比如还没写完）时显示代码
export function Mermaid({ code }: { code: string }) {
  const id = `mermaid-${useId().replace(/\W/g, '')}`
  const [result, setResult] = useState<{ code: string; svg: string }>()
  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const { default: mermaid } = await import('mermaid')
        // 用 Fluent 的 token 配色：节点是浅品牌色，线是可辨识的中性描边
        const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'base',
          themeVariables: {
            darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
            fontFamily: token('--fontFamilyBase'),
            fontSize: token('--fontSizeBase300'),
            background: token('--colorNeutralBackground1'),
            primaryColor: token('--colorBrandBackground2'),
            primaryBorderColor: token('--colorBrandStroke1'),
            primaryTextColor: token('--colorNeutralForeground1'),
            secondaryColor: token('--colorNeutralBackground3'),
            tertiaryColor: token('--colorNeutralBackground1'),
            lineColor: token('--colorNeutralStrokeAccessible'),
            textColor: token('--colorNeutralForeground1'),
          },
        })
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
