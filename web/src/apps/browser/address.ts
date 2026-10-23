export function isLoopback(url: URL) {
  return url.hostname === 'localhost' || url.hostname === '[::1]' || /^127(?:\.\d+){3}$/.test(url.hostname)
}

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
  // 本机地址通常是没有证书的开发服务器
  if (!explicit && isLoopback(url)) url.protocol = 'http:'
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
