import type { MiddlewareHandler } from 'hono'
import { Jwt } from 'hono/utils/jwt'
import { readFileSync } from 'node:fs'
import { accessPath, isTestInstance } from './paths.js'

type AccessConfig = {
  teamDomain: string
  aud: string
  ownerEmail: string
}

let loaded: AccessConfig | undefined

// 第一次用到时才读取：测试实例没有这个文件，也用不到它
function accessConfig(): AccessConfig {
  loaded ??= JSON.parse(readFileSync(accessPath, 'utf8')) as AccessConfig
  return loaded
}

// 测试实例只监听本机，前面没有 Cloudflare Access，不校验；预览也是测试实例，经正式版转发时已由正式版校验
export const requireOwner: MiddlewareHandler = async (c, next) => {
  if (isTestInstance) {
    return next()
  }
  const token = c.req.header('Cf-Access-Jwt-Assertion')
  if (!token) {
    return c.text('Unauthorized', 401)
  }
  const { teamDomain, aud, ownerEmail } = accessConfig()
  try {
    const payload = await Jwt.verifyWithJwks(token, {
      jwks_uri: `${teamDomain}/cdn-cgi/access/certs`,
      allowedAlgorithms: ['RS256'],
      verification: { iss: teamDomain, aud },
    })
    if (payload.email !== ownerEmail) {
      return c.text('Forbidden', 403)
    }
  } catch {
    return c.text('Unauthorized', 401)
  }
  await next()
}
