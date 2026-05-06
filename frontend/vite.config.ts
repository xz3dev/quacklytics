import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import tailwindcss from 'tailwindcss'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const frontendPort = Number(env.FRONTEND_PORT ?? env.VITE_FRONTEND_PORT ?? 3001)
  const backendOrigin = env.BACKEND_ORIGIN ?? env.VITE_BACKEND_ORIGIN ?? 'http://localhost:3000'

  return {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@app': path.resolve(__dirname, './src/app'),
        '@lib': path.resolve(__dirname, './src/lib'),
        '@assets': path.resolve(__dirname, './src/assets'),
      },
    },
    plugins: [
      react(),
    ],
    css: {
      postcss: {
        plugins: [tailwindcss()]
      }
    },
    server: {
      host: '0.0.0.0',
      port: frontendPort,
      strictPort: true,
      proxy: {
        '/api': {
          target: backendOrigin,
          changeOrigin: true,
          secure: false,
          ws: true,
        }
      }
    },
    build: {
      outDir: '../backend/server/public/frontend',
      emptyOutDir: true,
    },
  }
})
