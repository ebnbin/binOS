import { describe, expect, it } from 'vitest'
import { addressRoute, browserAddress, routeAddress } from './address.ts'

describe('browser addresses', () => {
  it('normalizes hosts, ports, unicode and encoded paths without losing query or fragment', () => {
    expect(browserAddress(' example.com/a?q=hello%20world#part ')).toBe('https://example.com/a?q=hello%20world#part')
    expect(browserAddress('localhost:3000/path')).toBe('https://localhost:3000/path')
    expect(browserAddress('http://127.0.0.1:3000')).toBe('http://127.0.0.1:3000/')
    expect(browserAddress('https://例子.测试')).toBe('https://xn--fsqu00a.xn--0zwm56d/')
  })

  it('rejects executable URLs, local files, credentials and malformed input', () => {
    for (const input of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///etc/passwd', 'ftp://example.com', 'https://user:password@example.com', '', 'hello world', 'https://']) {
      expect(() => browserAddress(input)).toThrow(/网址/)
    }
  })

  it('round trips addresses through the window route and rejects unsafe saved routes', () => {
    const url = 'https://example.com/a?next=%2Ffoo&query=中文#part'
    expect(routeAddress(addressRoute(browserAddress(url)))).toBe(browserAddress(url))
    expect(routeAddress('/?url=javascript%3Aalert(1)')).toBe('')
    expect(routeAddress('/')).toBe('')
    expect(addressRoute('')).toBe('/')
  })
})
