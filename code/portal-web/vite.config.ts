import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/portal/',
  server: {
    port: 5173,
    proxy: {
      '/society': 'http://127.0.0.1:8000',
      '/building': 'http://127.0.0.1:8000',
      '/registry': 'http://127.0.0.1:8000',
      '/unit': 'http://127.0.0.1:8000',
      '/units': 'http://127.0.0.1:8000',
      '/underground': 'http://127.0.0.1:8000',
      '/site-plan': 'http://127.0.0.1:8000',
      '/geo-site-plan': 'http://127.0.0.1:8000',
      '/disputes': 'http://127.0.0.1:8000',
      '/dispute': 'http://127.0.0.1:8000',
      '/ar': 'http://127.0.0.1:8000',
      '/viewer3d': 'http://127.0.0.1:8000',
      '/extract': 'http://127.0.0.1:8000',
    },
  },
  build: {
    outDir: '../app/staticportal',
    emptyOutDir: true,
  },
})
