// 网址始终是 /。在 app 里跳转时增加一条网址不变的历史记录，浏览器返回时 Shell 据此恢复那个窗口的路由并聚焦它
export type HistoryState = { window: string; route: string } | null

// 浏览器历史由所有窗口和外部 app 的 iframe 共用，history.back() 退的未必是这个窗口的记录。
// 所以 app 里的返回只退这个窗口自己的栈，栈只在这个标签页的内存里
const backStacks = new Map<string, string[]>()

export function pushBack(id: string, route: string) {
  backStacks.set(id, [...(backStacks.get(id) ?? []), route])
}

export function popBack(id: string): string | undefined {
  return backStacks.get(id)?.pop()
}

// 浏览器返回到某个窗口的 route 时，把这个窗口的栈退到同一处
export function restoreRoute(id: string, route: string) {
  const stack = backStacks.get(id)
  const at = stack?.lastIndexOf(route) ?? -1
  if (stack && at >= 0) {
    stack.length = at
  }
}
