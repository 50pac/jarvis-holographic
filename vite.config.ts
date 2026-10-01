import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const proxyTarget = `http://127.0.0.1:${process.env.PROXY_PORT || 8787}`;
const base = process.env.VITE_BASE || '/';
const unicodeBase = `${base.endsWith('/') ? base : `${base}/`}fonts/unicode`;

export default defineConfig({
  base,
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': proxyTarget,
      '/_AMapService': proxyTarget,
    },
  },
  plugins: [
    react(),
    {
      // troika-three-text bundles a default CDN URL (jsdelivr) for unicode fallback fonts.
      // index.tsx already points unicodeFontsURL at a local path; strip the dead default so the
      // bundle contains no external font URL at all.
      name: 'strip-troika-unicode-cdn',
      transform(code, id) {
        if (!id.includes('troika-three-text') || !code.includes('cdn.jsdelivr.net/gh/lojjic/unicode-font-resolver')) return null;
        return code.replace(/https:\/\/cdn\.jsdelivr\.net\/gh\/lojjic\/unicode-font-resolver@[^"'`]*/g, unicodeBase);
      },
    },
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return;
          if (/\/node_modules\/(?:react|react-dom|scheduler)\//.test(id)) return 'react';
          if (id.includes('/node_modules/@mediapipe/')) return 'mediapipe';
          if (id.includes('/node_modules/@react-three/')) return 'r3f';
          if (/\/node_modules\/(?:three|three-stdlib|postprocessing)\//.test(id)) return 'three';
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
