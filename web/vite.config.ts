import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.BINOS_SERVER_PORT ?? 3000}`,
        // 后端断开时也断开页面这一端，和正式版一样，页面的实时推送才会重连
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, _req, res) => {
            proxyRes.on('close', () => {
              if (!proxyRes.complete) {
                res.destroy()
              }
            })
          })
        },
      },
    },
  },
})
