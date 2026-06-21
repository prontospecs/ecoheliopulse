import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // index.html = standalone для GitHub Pages
  // index.dev.html = entry-point для npm run dev
  build: {
    rollupOptions: {
      input: 'index.dev.html'
    }
  },
  server: {
    // При запуске npm run dev открывать index.dev.html
    open: '/index.dev.html'
  }
})
