import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * إعداد Vite للـ Mini App.
 *
 * ملاحظة مهمة لبيئة المعاينة/التطوير:
 *  - الخادم يستمع على 0.0.0.0 ليظهر في المعاينة.
 *  - `/api` تُمرَّر إلى خادم Postora (proxy) حتى تستخدم الواجهة مسارات نسبية
 *    ولا تحتاج CORS ولا تشير إلى localhost من المتصفح.
 *  - allowedHosts مفتوحة للنطاقات الفرعية للمعاينة.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://127.0.0.1:3000',
        changeOrigin: true
      },
      '/health': {
        target: process.env.VITE_API_TARGET || 'http://127.0.0.1:3000',
        changeOrigin: true
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020'
  }
});
