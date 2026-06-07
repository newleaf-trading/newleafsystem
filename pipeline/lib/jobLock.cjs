'use strict';

/**
 * jobLock.cjs — PID-based job lock to prevent concurrent execution
 *
 * acquire(name) → true if lock obtained, false if another process holds it
 * release(name) → releases the lock
 * Auto-steals stale locks (PID not running).
 */

const fs = require('fs');
const path = require('path');

const LOCK_DIR = path.join(__dirname, '..');

function lockPath(name) {
  return path.join(LOCK_DIR, `.${name}.lock`);
}

function isPidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

/**
 * Acquire a named lock. Returns true if acquired, false if held by another live process.
 * @param {string} name - lock name (e.g. 'daily-oi', 'event-calendar')
 * @returns {boolean}
 */
function acquire(name) {
  const lp = lockPath(name);
  if (fs.existsSync(lp)) {
    try {
      const content = fs.readFileSync(lp, 'utf8').trim();
      const pid = parseInt(content, 10);
      if (pid && isPidAlive(pid)) {
        return false; // lock held by a live process
      }
      // Stale lock (process died) — steal it
      console.log(`[Lock] Stealing stale lock '${name}' from dead PID ${pid}`);
    } catch {}
  }
  fs.writeFileSync(lp, String(process.pid));

  // Auto-release on exit
  const cleanup = () => { try { release(name); } catch {} };
  process.once('exit', cleanup);
  process.once('SIGINT', () => { cleanup(); process.exit(0); });
  process.once('SIGTERM', () => { cleanup(); process.exit(0); });

  return true;
}

/**
 * Release a named lock.
 * @param {string} name
 */
function release(name) {
  const lp = lockPath(name);
  try {
    const content = fs.readFileSync(lp, 'utf8').trim();
    const pid = parseInt(content, 10);
    // Only delete if we own the lock
    if (pid === process.pid) {
      fs.unlinkSync(lp);
    }
  } catch {}
}

module.exports = { acquire, release };
