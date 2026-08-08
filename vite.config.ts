import { defineConfig } from 'vite';

// GitHub Pages serves project sites under /<repository>/, so the production build
// needs that base path. The dev server keeps serving from the root.
const GITHUB_PAGES_BASE = '/3D_Tetris/';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? GITHUB_PAGES_BASE : '/',
  server: { port: 5173, open: true },
  build: { target: 'es2022' },
}));
