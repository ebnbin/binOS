import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['server/src/**/*.test.ts', 'web/src/**/*.test.ts', 'scripts/**/*.test.ts'],
    // 这个包的 ES 模块里有不带扩展名的导入，Node 直接加载会失败，交给 Vite 转换
    server: { deps: { inline: ['@material/material-color-utilities'] } },
  },
})
