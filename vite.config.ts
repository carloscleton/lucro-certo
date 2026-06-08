import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React core
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router-dom/') || id.includes('node_modules/scheduler/')) {
            return 'vendor-react';
          }
          // Charts
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-') || id.includes('node_modules/victory-')) {
            return 'vendor-charts';
          }
          // PDF / Canvas
          if (id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas') || id.includes('node_modules/pdfmake')) {
            return 'vendor-pdf';
          }
          // PDF.js (viewer)
          if (id.includes('node_modules/pdfjs-dist')) {
            return 'vendor-pdfjs';
          }
          // Icons & animation
          if (id.includes('node_modules/lucide-react') || id.includes('node_modules/framer-motion') || id.includes('node_modules/@radix-ui')) {
            return 'vendor-ui';
          }
          // Supabase
          if (id.includes('node_modules/@supabase')) {
            return 'vendor-supabase';
          }
          // Date utilities
          if (id.includes('node_modules/date-fns') || id.includes('node_modules/dayjs') || id.includes('node_modules/moment')) {
            return 'vendor-date';
          }
          // i18n
          if (id.includes('node_modules/i18next') || id.includes('node_modules/react-i18next')) {
            return 'vendor-i18n';
          }
          // QR / barcode / camera
          if (id.includes('node_modules/qr-scanner') || id.includes('node_modules/react-qr-code') || id.includes('node_modules/react-barcode') || id.includes('node_modules/@zxing')) {
            return 'vendor-qr';
          }
          // Drag and drop
          if (id.includes('node_modules/@hello-pangea')) {
            return 'vendor-dnd';
          }
          // Crypto / security
          if (id.includes('node_modules/crypto-js')) {
            return 'vendor-crypto';
          }
          // HTTP / networking
          if (id.includes('node_modules/axios')) {
            return 'vendor-http';
          }
          // Onboarding / tour
          if (id.includes('node_modules/react-joyride') || id.includes('node_modules/react-is')) {
            return 'vendor-tour';
          }
          // Print
          if (id.includes('node_modules/react-to-print')) {
            return 'vendor-print';
          }
          // Remaining node_modules
          if (id.includes('node_modules/')) {
            return 'vendor-misc';
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react-is', 'react-joyride']
  },
})
