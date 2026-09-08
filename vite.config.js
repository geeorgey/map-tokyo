import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: { rollupOptions: { output: { manualChunks: { three: ['three'], react: ['react','react-dom'] } } } },
});
