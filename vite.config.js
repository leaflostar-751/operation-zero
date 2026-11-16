import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // relative paths so the dist folder works on itch.io / Netlify / any sub-folder
  server: {
    port: 3000,
    open: true
  },
  build: {
    target: 'esnext',
    sourcemap: false,
    chunkSizeWarningLimit: 1500
  }
});
