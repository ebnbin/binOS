export const mailBase = '/api/apps/mail'

export async function mailRequest<T>(resource: string, options?: { method: string; body?: unknown; signal?: AbortSignal }): Promise<T> {
  const response = await fetch(`${mailBase}${resource}`, {
    method: options?.method ?? 'GET', signal: options?.signal,
    ...(options?.method && { headers: { 'Content-Type': 'application/json' } }),
    ...(options?.body !== undefined && { body: JSON.stringify(options.body) }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `邮件请求失败（${response.status}）`)
  }
  return response.json() as Promise<T>
}
