import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    // VERCEL_GIT_COMMIT_SHA e injetada automaticamente pela Vercel em
    // builds de producao/preview — Vite nao expoe isso no client bundle
    // por padrao (so variaveis VITE_*), por isso repassamos explicitamente
    // via `define`. Fallback "dev" fora da Vercel.
    __BUILD_ID__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 7)),
  },
})
