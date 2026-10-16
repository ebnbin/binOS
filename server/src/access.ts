import type { MiddlewareHandler } from 'hono'
import { Jwt } from 'hono/utils/jwt'
import { config } from './config.js'

// 只放行经过 Cloudflare Access 登录、且邮箱是主人的请求
export const requireOwner: MiddlewareHandler = async (c, next) => {
  const token = c.req.header('Cf-Access-Jwt-Assertion')
  if (!token) {
    return c.text('Unauthorized', 401)
  }
  try {
    const payload = await Jwt.verifyWithJwks(token, {
      jwks_uri: `${config.access.teamDomain}/cdn-cgi/access/certs`,
      allowedAlgorithms: ['RS256'],
      verification: { iss: config.access.teamDomain, aud: config.access.aud },
    })
    if (payload.email !== config.ownerEmail) {
      return c.text('Forbidden', 403)
    }
  } catch {
    return c.text('Unauthorized', 401)
  }
  await next()
}
