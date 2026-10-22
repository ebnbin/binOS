import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 色彩工具的 ESM 包含无扩展名导入，通过 Vite 解析。
    server: { deps: { inline: ['@material/material-color-utilities'] } },
    include: ['server/src/**/*.test.ts', 'web/src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
