import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-ignore
import eslint from 'vite-plugin-eslint2'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic'
    }),
    eslint({
      cache: false,
      include: ['src/**/*.{ts,tsx}', 'src/**/*.{js,jsx}'],
      exclude: ['node_modules', 'dist', 'scripts/**', 'code_examples/**'],
      lintOnStart: true,
      // emitError: true,
      emitWarning: true,
      formatter: 'stylish',
    })
  ],
  base: './', // Important for Electron
  root: '.',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Kinhank X5 Pro ships Chrome 79; keep the public build compatible with it.
    target: ['chrome79', 'es2019'],
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console logs for debugging
        drop_debugger: true,
        // Remove pure_funcs to keep console logs
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          rapier: ['@react-three/rapier'],
          utils: ['zustand']
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    // Electron-specific optimizations
    sourcemap: false,
    reportCompressedSize: false
  },
  server: {
    port: 5173,
    strictPort: true
  },
  optimizeDeps: {
    exclude: ['electron'],
    include: ['three', '@react-three/fiber', '@react-three/drei', '@react-three/rapier']
  },
  // Additional Electron optimizations
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  }
})
