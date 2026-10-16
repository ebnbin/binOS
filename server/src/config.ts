import { readFileSync } from 'node:fs'
import path from 'node:path'
import { libraryDir } from './paths.js'

type Config = {
  access: {
    teamDomain: string
    aud: string
  }
  ownerEmail: string
}

export const config: Config = JSON.parse(
  readFileSync(path.join(libraryDir, 'config.json'), 'utf8'),
)
