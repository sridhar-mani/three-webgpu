import { defineConfig } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server:{
    fs:{
      allow:[
        path.resolve(__dirname),  path.resolve(__dirname, '..'),path.resolve(__dirname, '../dist')
      ]
    },
    headers:{
       'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  optimizeDeps:{
    esbuildOptions:{
      target:"esnext"
    }
  },
  build:{
    target:"esnext"
  }, worker:{
    format:"es",
    plugins:()=>[]
  }
})
