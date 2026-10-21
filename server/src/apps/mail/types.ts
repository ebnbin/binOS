export type MailSummary = {
  id: string
  threadId: string
  subject: string
  from: string
  to: string
  date: number
  snippet: string
  labels: string[]
}

export type MailAttachment = { id: number; name: string; type: string; size: number; cid?: string }
export type MailMessage = MailSummary & {
  cc: string
  bcc: string
  replyTo: string
  html: string
  text: string
  attachments: MailAttachment[]
  warnings: string[]
}
export type MailThread = { id: string; messages: MailMessage[]; cached?: boolean }
export type MailPage = { threads: MailSummary[]; next?: string; cached?: boolean }
export type MailStatus = {
  configured: boolean
  connected: boolean
  email?: string
  clientId?: string
  redirectUri?: string
  lastSync?: number
  error?: string
  syncing: boolean
}

export type GmailMessage = {
  id: string
  threadId: string
  labelIds?: string[]
  snippet?: string
  internalDate?: string
  raw?: string
  payload?: { headers?: { name: string; value: string }[] }
}
