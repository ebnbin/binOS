import { OAuth2Client } from 'google-auth-library'
import type { MailStore, Account } from './store.js'

export class MailError extends Error {
  readonly status: number
  constructor(message: string, status = 502) { super(message); this.status = status }
}

export type GmailRequest = <T>(resource: string, options?: { method?: 'POST'; data?: unknown }) => Promise<T>

export function oauthClient(account: Account) {
  return new OAuth2Client({ clientId: account.clientId, clientSecret: account.clientSecret, redirectUri: account.redirectUri, transporterOptions: { timeout: 20_000 } })
}

export function gmailRequest(store: MailStore): GmailRequest {
  let client: OAuth2Client | undefined
  let identity: string | undefined
  return async <T>(resource: string, options?: { method?: 'POST'; data?: unknown }) => {
    const account = store.account()
    if (!account?.tokens?.refresh_token) throw new MailError('请连接 Gmail 账号', 401)
    const key = JSON.stringify([account.clientId, account.clientSecret, account.redirectUri, account.tokens.refresh_token])
    if (!client || identity !== key) {
      identity = key
      client = oauthClient(account)
      client.setCredentials(account.tokens)
      client.on('tokens', (tokens) => {
        const current = store.account()
        if (current && current.tokens?.refresh_token === account.tokens?.refresh_token) store.saveAccount({ ...current, tokens: { ...current.tokens, ...tokens } })
      })
    }
    try {
      const response = await client.request<T>({
        url: `https://gmail.googleapis.com/gmail/v1/users/me/${resource}`,
        method: options?.method ?? 'GET', data: options?.data, timeout: 20_000,
        retry: true, retryConfig: { retry: 2 },
      })
      return response.data
    } catch (error) {
      const status = (error as { response?: { status?: number; data?: { error?: unknown } } }).response?.status
      const code = (error as { response?: { data?: { error?: unknown } } }).response?.data?.error
      if (status === 401 || code === 'invalid_grant') throw new MailError('Gmail 授权已失效，请重新连接', 401)
      if (status === 404) throw new MailError('邮件不存在或同步记录已过期', 404)
      if (status === 403) throw new MailError('Gmail 拒绝访问，请确认已启用 Gmail API 并授予邮件权限', 403)
      if (status === 429) throw new MailError('Gmail 请求过于频繁，稍后会自动重试', 429)
      throw new MailError('暂时无法连接 Gmail，请稍后重试')
    }
  }
}
