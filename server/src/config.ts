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

let loaded: Config | undefined

// 第一次用到时才读取：测试实例没有这个文件，也用不到它
export function config(): Config {
  loaded ??= JSON.parse(readFileSync(path.join(libraryDir, 'config.json'), 'utf8'))
  return loaded!
}
