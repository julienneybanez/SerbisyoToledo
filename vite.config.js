import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-bootstrap': ['bootstrap'],
          'vendor-calendar': ['@fullcalendar/react', '@fullcalendar/bootstrap5', 'react-day-picker', 'temporal-polyfill'],
        },
      },
    },
  },
})
