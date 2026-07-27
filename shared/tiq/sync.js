'use strict';

/**
 * Sync the canonical TIQ engine into the static Workbench so the browser scores
 * a sitting with byte-for-byte the same code the Node tests cover. There is no
 * bundler for the static workbench (Vite copies it verbatim), so this is the
 * anti-drift mechanism — the same one shared/plan/sync.js uses.
 *
 *   node sync.js          # write web/workbench/public/js/tiqEngine.js
 *   node sync.js --check   # exit 1 if the copy is stale (release blocker)
 *
 * Silent drift between the browser and Node scoring would defeat the entire
 * determinism guarantee, so `--check` must gate any release that ships a TIQ
 * Workbench surface. Edit the module sources only; never hand-edit tiqEngine.js.
 *
 * The four scoring modules are authored in plain CommonJS with no sibling
 * requires and unique top-level identifiers, so they concatenate into one
 * browser scope cleanly. index.js and its Node-only require()s are NOT bundled;
 * the browser gets a flat window.TIQEngine plus namespaced sub-objects.
 */

const fs = require('fs');
const path = require('path');

const MODULES = ['scoring.js', 'norms.js', 'calibration.js', 'sim.js'];
const DEST = path.join(__dirname, '..', '..', 'web', 'workbench', 'public', 'js', 'tiqEngine.js');

const BANNER =
  '/* GENERATED from shared/tiq/{scoring,norms,calibration,sim}.js — DO NOT EDIT.\n' +
  '   Edit the module sources and run `node shared/tiq/sync.js`. */\n';

/** Strip the leading 'use strict' pragma and the trailing module.exports block. */
function stripModule(src) {
  let s = src.replace(/^'use strict';\s*\n/, '');
  const idx = s.lastIndexOf('\nmodule.exports');
  return idx > -1 ? s.slice(0, idx).trimEnd() : s.trimEnd();
}

function build() {
  const namespaced = {};
  const bodies = [];
  for (const file of MODULES) {
    const name = path.basename(file, '.js');
    const src = fs.readFileSync(path.join(__dirname, file), 'utf8');
    bodies.push('// ── ' + file + ' ──\n' + stripModule(src));
    namespaced[name] = Object.keys(require('./' + file));
  }

  const allNames = [];
  for (const name of Object.keys(namespaced)) for (const k of namespaced[name]) if (!allNames.includes(k)) allNames.push(k);
  const nsAssign = Object.keys(namespaced)
    .map(name => `    ${name}: { ${namespaced[name].join(', ')} }`)
    .join(',\n');

  return BANNER +
    ';(function (root) {\n' +
    "'use strict';\n\n" +
    bodies.join('\n\n') + '\n\n' +
    '  var TIQEngine = {\n' +
    '    ' + allNames.join(', ') + ',\n' +
    nsAssign + '\n' +
    '  };\n' +
    "  if (typeof module !== 'undefined' && module.exports) module.exports = TIQEngine;\n" +
    '  else root.TIQEngine = TIQEngine;\n' +
    "})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));\n";
}

const expected = build();

if (process.argv.includes('--check')) {
  const actual = fs.existsSync(DEST) ? fs.readFileSync(DEST, 'utf8') : '';
  if (actual !== expected) {
    console.error('tiqEngine.js is OUT OF SYNC with shared/tiq/*.js — run `node shared/tiq/sync.js`');
    process.exit(1);
  }
  console.log('tiqEngine.js in sync ✓');
} else {
  fs.mkdirSync(path.dirname(DEST), { recursive: true });
  fs.writeFileSync(DEST, expected);
  console.log('Wrote ' + path.relative(path.join(__dirname, '..', '..'), DEST));
}
