import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['server/src/**/*.test.ts', 'web/src/**/*.test.ts', 'scripts/**/*.test.ts'],
    // Spectrum 2 的图标包在模块里引入自己的 CSS，交给 Vite 处理
    server: { deps: { inline: ['@react-spectrum/s2'] } },
  },
})
