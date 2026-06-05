import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'IntentLayer',
      formats: ['es', 'iife'],
      fileName: (format) => `intent-layer${format === 'iife' ? '.iife' : ''}.js`,
    },
    rollupOptions: {
      output: {
        compact: true,
      },
    },
    reportCompressedSize: true,
    target: 'es2020',
    minify: 'terser',
  },
})
