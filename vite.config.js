import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Replace <repo-name> with your repo's name, e.g. 'Method-Swatch'
export default defineConfig({
  plugins: [react()],
  base: '/<repo-name>/',   // e.g. '/Method-Swatch/'
})
