import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const proxyTarget = `http://127.0.0.1:${process.env.PROXY_PORT || 8787}`;
const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': proxyTarget,
    },
  },
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const moduleId = id.replace(/\\/g, '/');
          if (!moduleId.includes('/node_modules/')) return;
          if (/\/node_modules\/(?:react|react-dom|scheduler)\//.test(moduleId)) return 'react';
          if (moduleId.includes('/node_modules/@mediapipe/')) return 'mediapipe';
          if (/\/node_modules\/(?:three|three-stdlib|postprocessing|maath)\//.test(moduleId)
            || /\/node_modules\/(?:@react-three|@monogrid)\//.test(moduleId)) return 'stage';
        },
      },
    },
    // Three.js and MediaPipe remain large even after splitting, so allow their vendor chunks.
    chunkSizeWarningLimit: 1200,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
