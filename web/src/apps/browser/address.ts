export function browserAddress(input: string): string {
  const value = input.trim()
  if (!value || /\s/.test(value)) throw new Error('请输入完整网址，例如 example.com')
  const explicit = /^[a-z][a-z\d+.-]*:/i.test(value) && !/^[^/:]+:\d+(?:[/?#]|$)/.test(value)
  let url: URL
  try {
    url = new URL(explicit ? value : `https://${value.replace(/^\/\//, '')}`)
  } catch {
    throw new Error('网址格式不正确')
  }
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('仅支持 HTTP 和 HTTPS 网址')
  if (url.username || url.password) throw new Error('请使用不含用户名和密码的网址')
  return url.href
}

export const addressRoute = (url: string) => url ? `/?url=${encodeURIComponent(url)}` : '/'

export function routeAddress(route: string): string {
  const value = new URLSearchParams(route.split('?')[1]).get('url')
  if (!value) return ''
  try {
    return browserAddress(value)
  } catch {
    return ''
  }
}
