import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      // Forward API requests to the Express backend (backend/, port 3001)
      '/api': 'http://localhost:3001',
    },
  },
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
      // Resolve Figma Make asset imports to local files in src/assets
      'figma:asset/933b21dd0e7f43328405b2f83783e6907d3d0236.png': path.resolve(
        __dirname,
        './src/assets/933b21dd0e7f43328405b2f83783e6907d3d0236.png'
      ),
    },
  },
})
