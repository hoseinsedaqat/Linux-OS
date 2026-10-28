import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The app must work when hosted from a GitHub Pages project sub-path
 * (e.g. https://user.github.io/Linux-OS/).
 *
 * - In dev we serve from `/`.
 * - For production builds the base path can be supplied via `VITE_BASE`
 *   (the GitHub Actions workflow derives it from the repository name).
 * - Every asset reference inside the app is relative or uses `import.meta.env.BASE_URL`,
 *   so no absolute `/assets/...` URLs leak into the bundle.
 */
export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE ?? (command === 'build' ? '/Linux-OS/' : '/'),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1200,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    /* The sandbox proxies the dev server through its own preview host. */
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
}));
