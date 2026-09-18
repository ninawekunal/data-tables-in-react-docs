import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves this repo from /<repo-name>/.
// Override with VITE_BASE=/ when deploying to a custom domain or a user page.
const base = process.env.VITE_BASE ?? '/data-tables-in-react-docs/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
})
