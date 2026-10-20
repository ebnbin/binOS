import { describe, expect, it } from 'vitest'
import { findToken, redact } from './login.js'

const token = `sk-ant-oat01-${'a1B2_c3D4-'.repeat(9)}xyzAA`

describe('findToken', () => {
  it('认出折成几行、带缩进的令牌', () => {
    const text = `✓ Long-lived authentication token created successfully!\n\n  ${token.slice(0, 50)}\n  ${token.slice(50)}\n\n Store this token securely.`
    expect(findToken(text)).toBe(token)
  })

  it('后面那句还没出来时不算', () => {
    expect(findToken(`created successfully!\n${token}`)).toBeUndefined()
  })
})

describe('redact', () => {
  it('令牌出现之后的都不要，像令牌的长串遮掉', () => {
    expect(redact(`OAuth error abcdefghijklmnopqrstuvwxyz0123 created successfully! ${token}`)).toBe('OAuth error … ')
  })
})
