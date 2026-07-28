import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { cpSync, existsSync } from 'fs';

/**
 * Copies static app directories (workbench, etc.) into dist/ after build.
 * These are standalone HTML apps that Vite doesn't process — they just
 * need to be present in the output directory for Firebase hosting.
 */
function copyStaticApps() {
  return {
    name: 'copy-static-apps',
    closeBundle() {
      const staticDirs = ['workbench'];
      for (const dir of staticDirs) {
        const src = path.resolve(__dirname, dir);
        const dest = path.resolve(__dirname, 'dist', dir);
        if (existsSync(src)) {
          cpSync(src, dest, { recursive: true });
          console.log(`  Copied ${dir}/ → dist/${dir}/`);
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyStaticApps()],
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: false, // preserve dist/picks/, dist/quant/, dist/desk/
    // shared/tiq/scoring.js is CommonJS and lives outside node_modules, so tell
    // the commonjs plugin to transform it (default: node_modules only).
    commonjsOptions: { include: [/node_modules/, /shared[\\/]tiq[\\/]/] },
  },
  resolve: {
    alias: {
      '@trading': path.resolve(__dirname, 'src/trading'),
      '@workbench': path.resolve(__dirname, 'src/workbench'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@picks': path.resolve(__dirname, 'src/picks'),
      '@app-firebase': path.resolve(__dirname, 'src/firebase'),
      // Repo-root TIQ scoring (pure CJS, no sibling requires) + the front-door bank.
      '@tiq-scoring': path.resolve(__dirname, '../shared/tiq/scoring.js'),
      '@tiq-frontdoor': path.resolve(__dirname, '../content/tiq/frontdoor-v1.json'),
    },
  },
  server: {
    // Allow importing the shared engine and content bank from the repo root.
    fs: { allow: [path.resolve(__dirname, '..')] },
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/r2': {
        target: 'https://pub-04bbb919022645b3a3f318b2ebdf48c0.r2.dev',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/r2/, ''),
      },
    },
  },
});
