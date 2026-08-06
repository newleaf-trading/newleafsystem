'use strict';

/**
 * publish.js — STEP 6. Upload the final MP4 to Cloudflare R2 (S3-compatible)
 * and record the public URL in the manifest.
 *
 * Endpoint follows the monorepo convention: R2 is addressed as an S3 endpoint
 * at https://<account_id>.r2.cloudflarestorage.com with region "auto".
 *
 * Idempotent: skips upload if final.r2_url is already set unless --force.
 */

const fs = require('fs');
const path = require('path');
const { loadManifest, saveManifest } = require('./lib/manifest');
const { requireEnv } = require('./lib/util');

async function runPublish(epDir, { force = false } = {}) {
  const manifest = loadManifest(epDir);

  if (manifest.final.status !== 'done' || !manifest.final.file) {
    throw new Error('No assembled final video — run the assemble step first.');
  }
  const localAbs = path.join(epDir, manifest.final.file);
  if (!fs.existsSync(localAbs)) throw new Error(`Final file missing: ${localAbs}`);

  // ── R2 archival upload (skipped if already done unless --force) ──
  if (manifest.final.r2_url && !force) {
    console.log(`  ↻ Already on R2: ${manifest.final.r2_url} (use --force to re-upload)`);
  } else {
    requireEnv(['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET']);

    // Lazy-require so the rest of the pipeline runs without the AWS SDK installed.
    let S3Client, PutObjectCommand;
    try {
      ({ S3Client, PutObjectCommand } = require('@aws-sdk/client-s3'));
    } catch {
      throw new Error(
        '@aws-sdk/client-s3 is not installed. Run `npm install` in video/ before publishing.'
      );
    }

    const endpoint = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

    const key = `videos/${manifest.episode}.mp4`;
    const body = fs.readFileSync(localAbs);

    console.log(`  ▶ Uploading ${(body.length / 1e6).toFixed(1)}MB → R2:${process.env.R2_BUCKET}/${key}`);
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: 'video/mp4',
        CacheControl: 'public, max-age=3600',
      })
    );

    const base = process.env.R2_PUBLIC_BASE_URL
      ? process.env.R2_PUBLIC_BASE_URL.replace(/\/+$/, '')
      : null;
    const publicUrl = base ? `${base}/${key}` : `r2://${process.env.R2_BUCKET}/${key}`;

    manifest.final.r2_url = publicUrl;
    saveManifest(epDir, manifest);
    console.log(`  ✓ On R2: ${publicUrl}`);
    if (!base) {
      console.log('    (set R2_PUBLIC_BASE_URL in .env to record a real public https URL)');
    }
  }

  // ── Social distribution (YouTube + Instagram) ──
  // Runs only if manifest.distribution is present. DRY-RUN unless SOCIAL_PUBLISH=1.
  // IG never auto-releases (container-only) unless distribution.instagram.publish=true.
  if (manifest.distribution) {
    const live = process.env.SOCIAL_PUBLISH === '1';
    console.log(`  ── social distribution (${live ? 'LIVE' : 'dry-run'}) ──`);
    const { publishYouTube } = require('./publish/youtube');
    const { publishInstagram } = require('./publish/instagram');
    try {
      await publishYouTube(epDir, manifest, { live, force });
    } catch (e) { console.warn(`  ⚠ YouTube step failed: ${e.message}`); }
    try {
      await publishInstagram(epDir, manifest, { live });
    } catch (e) { console.warn(`  ⚠ Instagram step failed: ${e.message}`); }
    saveManifest(epDir, manifest);
  }

  return manifest;
}

module.exports = { runPublish };
