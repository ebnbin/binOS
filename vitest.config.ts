import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    server: { deps: { inline: [/@react-spectrum\/s2/] } },
    include: ['server/src/**/*.test.ts', 'web/src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
