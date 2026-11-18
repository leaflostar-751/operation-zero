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
    chunkSizeWarningLimit: 1500,
    // Hashed bundles go to dist/bundle/ so they can be cached "forever" (see public/_headers); public/assets/ (models, textures,
    // decoders) keeps its own folder and its own, shorter cache rule.
    assetsDir: 'bundle',
    rollupOptions: {
      output: {
        // Engine libraries change rarely: separate chunks download in parallel and stay cached across game updates.
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three';
          if (id.includes('node_modules/@dimforge/')) return 'rapier';
        }
      }
    }
  }
});
