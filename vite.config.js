import { defineConfig } from 'vite'

export default defineConfig({
  // Treat .ink.json files as static assets
  assetsInclude: ['**/*.ink.json'],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
