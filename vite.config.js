import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Replace with your repo name exactly:
const repoName = 'Method-Swatch'

export default defineConfig({
  plugins: [react()],
  base: `/${repoName}/`,
})
