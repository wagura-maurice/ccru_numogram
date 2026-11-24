import { defineConfig } from 'vite'
import { copyFileSync } from 'node:fs'

export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'copy-numogram-svg',
      writeBundle() {
        copyFileSync('Numogram.svg', 'dist/Numogram.svg')
      }
    }
  ],
  build: {
    rollupOptions: {
      input: 'index.html',
      output: {
        assetFileNames: 'assets/[name][extname]',
        chunkFileNames: 'assets/[name].js',
        entryFileNames: 'assets/[name].js',
      },
      external: ['three']
    }
  }
})
