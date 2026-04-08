import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __APP_VERSION__: JSON.stringify('0.0.0-test'),
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    css: false,
  },
});
