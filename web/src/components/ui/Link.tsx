import type { AnchorHTMLAttributes, MouseEvent } from 'react'
import { navigate } from '../../router.ts'

// 普通点击在页面内跳转；按着修饰键或用中键时交给浏览器，比如在新标签页打开
export function Link({ to, onClick, ...props }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }
    event.preventDefault()
    navigate(to)
  }
  return <a href={to} onClick={handleClick} {...props} />
}
