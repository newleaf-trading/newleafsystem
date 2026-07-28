#!/usr/bin/env node
'use strict';

/**
 * Point git at the committed hooks directory so the TIQ pre-commit guard works
 * on every clone, not just the one it was first configured on. Runs from a
 * package `postinstall`. No-ops silently outside a git work tree (CI installing
 * from a tarball, a vendored copy, etc.) so it can never break an install.
 *
 * The hook itself (scripts/git-hooks/pre-commit) is convenience; the real
 * guarantee is the predeploy chain (sync --check + validate-bank).
 */

const { execSync } = require('child_process');

try {
  execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
} catch {
  process.exit(0); // not a git work tree — nothing to configure
}

try {
  execSync('git config core.hooksPath scripts/git-hooks', { stdio: 'ignore' });
  console.log('TIQ: git core.hooksPath → scripts/git-hooks');
} catch {
  // best-effort; never fail the install
}
