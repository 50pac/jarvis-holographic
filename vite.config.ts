import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const proxyTarget = `http://127.0.0.1:${process.env.PROXY_PORT || 8787}`;

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': proxyTarget,
      '/_AMapService': proxyTarget,
    },
  },
  plugins: [react()],
  assetsInclude: ['**/*.task'],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
