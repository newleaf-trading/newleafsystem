#!/usr/bin/env node
/**
 * clean-spa.js — Pre-build cleanup
 * Removes old SPA directories from dist/ before Vite build.
 * Preserves: dist/picks/ (until React picks pages replace them),
 *            dist/quant/, dist/desk/ (untouched apps)
 */

import { rmSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, '../dist');

const CLEAN_DIRS = [
  'trading',   // old pre-built trading SPA (now built by Vite into root)
  'assets',    // old Vite build chunks (rebuilt each time)
  'picks',     // now served dynamically by the React SPA
  // NOTE: dist/workbench/ is static HTML (newleaf-alpaca-r2) — do NOT clean
];

for (const dir of CLEAN_DIRS) {
  const target = resolve(DIST, dir);
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
    console.log(`  cleaned: dist/${dir}/`);
  }
}

console.log('  pre-build cleanup done');
