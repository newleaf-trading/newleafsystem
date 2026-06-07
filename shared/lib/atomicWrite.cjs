'use strict';

/**
 * atomicWrite.cjs — Write files safely via temp + rename
 *
 * Writes to a .tmp file, validates JSON if applicable, then atomically
 * renames to the final path. If anything fails, the old file stays intact.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Write a file atomically: write to .tmp, validate, rename.
 * @param {string} filePath - final destination
 * @param {string} content - file content
 * @param {{ validateJson?: boolean }} [opts]
 */
function atomicWriteSync(filePath, content, opts) {
  const tmpPath = filePath + '.tmp.' + crypto.randomBytes(4).toString('hex');
  try {
    // Validate JSON before writing if requested
    if (opts?.validateJson) {
      JSON.parse(content); // throws if invalid
    }

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Write to temp file
    fs.writeFileSync(tmpPath, content, 'utf8');

    // Atomic rename (same filesystem = atomic on POSIX)
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    // Clean up temp file if it exists
    try { fs.unlinkSync(tmpPath); } catch {}
    throw err;
  }
}

/**
 * Write multiple files atomically as a group.
 * All temp files are written first, then all renames happen.
 * If any rename fails, previously renamed files are NOT rolled back
 * (rename is atomic per-file, but the group is best-effort).
 * @param {Array<{ path: string, content: string }>} files
 * @param {{ validateJson?: boolean }} [opts]
 */
function atomicWriteMultiSync(files, opts) {
  const tmpFiles = [];
  try {
    // Phase 1: write all temp files
    for (const f of files) {
      if (opts?.validateJson) JSON.parse(f.content);
      const tmpPath = f.path + '.tmp.' + crypto.randomBytes(4).toString('hex');
      const dir = path.dirname(f.path);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(tmpPath, f.content, 'utf8');
      tmpFiles.push({ tmpPath, finalPath: f.path });
    }

    // Phase 2: rename all (each rename is atomic)
    for (const t of tmpFiles) {
      fs.renameSync(t.tmpPath, t.finalPath);
    }
  } catch (err) {
    // Clean up any remaining temp files
    for (const t of tmpFiles) {
      try { fs.unlinkSync(t.tmpPath); } catch {}
    }
    throw err;
  }
}

module.exports = { atomicWriteSync, atomicWriteMultiSync };
