'use strict';

/**
 * Sync the canonical plan model into the static Workbench so the page at /workbench/plan
 * loads byte-for-byte the same code the Node tests cover. There is no bundler for the static
 * workbench (Vite only copies web/workbench verbatim), so this is the anti-drift mechanism:
 * edit shared/plan/index.js, run this, commit both.
 *
 *   node shared/plan/sync.js          # write the copy
 *   node shared/plan/sync.js --check  # exit 1 if the copy is stale (CI/guard)
 */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'index.js');
const DEST = path.join(__dirname, '..', '..', 'web', 'workbench', 'public', 'js', 'planModel.js');

const BANNER =
  '/* GENERATED from shared/plan/index.js — DO NOT EDIT.\n' +
  '   Edit the source and run `node shared/plan/sync.js`. */\n';

const expected = BANNER + fs.readFileSync(SRC, 'utf8');

if (process.argv.includes('--check')) {
  const actual = fs.existsSync(DEST) ? fs.readFileSync(DEST, 'utf8') : '';
  if (actual !== expected) {
    console.error('planModel.js is OUT OF SYNC with shared/plan/index.js — run `node shared/plan/sync.js`');
    process.exit(1);
  }
  console.log('planModel.js in sync ✓');
} else {
  fs.writeFileSync(DEST, expected);
  console.log('Wrote ' + path.relative(path.join(__dirname, '..', '..'), DEST));
}
