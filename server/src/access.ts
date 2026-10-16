import type { MiddlewareHandler } from 'hono'
import { Jwt } from 'hono/utils/jwt'
import { config } from './config.js'
import { isTestInstance } from './paths.js'

// 只放行经过 Cloudflare Access 登录、且邮箱是 ownerEmail 的请求。测试实例只能从本机访问，不校验
export const requireOwner: MiddlewareHandler = async (c, next) => {
  if (isTestInstance) {
    return next()
  }
  const token = c.req.header('Cf-Access-Jwt-Assertion')
  if (!token) {
    return c.text('Unauthorized', 401)
  }
  const { access, ownerEmail } = config()
  try {
    const payload = await Jwt.verifyWithJwks(token, {
      jwks_uri: `${access.teamDomain}/cdn-cgi/access/certs`,
      allowedAlgorithms: ['RS256'],
      verification: { iss: access.teamDomain, aud: access.aud },
    })
    if (payload.email !== ownerEmail) {
      return c.text('Forbidden', 403)
    }
  } catch {
    return c.text('Unauthorized', 401)
  }
  await next()
}
