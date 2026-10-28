import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
 resolve: { alias: {'@':path.resolve('src'),'@app':path.resolve('src/app'),'@lib':path.resolve('src/lib'),'@assets':path.resolve('src/assets')} },
 plugins:[tailwindcss(),tanstackStart(),react()],
 optimizeDeps:{exclude:['@duckdb/node-api','better-auth','bun:sqlite']},
 server:{host:'127.0.0.1',port:3000,strictPort:true},
 ssr:{external:['bun:sqlite','@duckdb/node-api','better-auth']},
})
