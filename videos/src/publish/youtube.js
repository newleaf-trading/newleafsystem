'use strict';

/**
 * youtube.js — publish adapter for the YouTube Data API v3.
 *
 * SAFETY: dry-run by DEFAULT. It only performs a live upload when explicitly
 * enabled (opts.live === true, set from SOCIAL_PUBLISH=1). Without credentials it
 * skips cleanly (never throws inside the pipeline). Reads/writes
 * manifest.distribution.youtube.
 *
 * ⚠ TWO CONSTRAINTS TO KNOW (spec §7.1):
 *  1. QUOTA — a video upload costs 1600 units against the default 10,000/day →
 *     ~6 uploads/day. This adapter logs the cost; it cannot see remaining quota,
 *     so batch runs may hit quotaExceeded. Warn, never silently drop.
 *  2. AUDIT GATE — an UNAUDITED API project has uploads FORCED to `private`
 *     regardless of the privacyStatus sent, until it passes YouTube's compliance
 *     audit. VERIFY your project is audited before trusting `unlisted`/`public`.
 *
 * Live upload requires `googleapis` (not a pipeline dependency): `npm i googleapis`.
 */

const fs = require('fs');
const path = require('path');

const YT_ENV = ['YT_CLIENT_ID', 'YT_CLIENT_SECRET', 'YT_REFRESH_TOKEN'];

function haveCreds() {
  return YT_ENV.every((k) => process.env[k]);
}

/**
 * @param {string} epDir
 * @param {object} manifest
 * @param {{ live?: boolean }} opts
 * @returns {Promise<{status:string, video_id?:string, url?:string}>}
 */
async function publishYouTube(epDir, manifest, opts = {}) {
  const dist = manifest.distribution && manifest.distribution.youtube;
  if (!dist) return { status: 'skipped:no-config' };

  const live = opts.live === true;
  const fileRel = dist.file || (manifest.final && manifest.final.file);
  const fileAbs = fileRel ? path.join(epDir, fileRel) : null;
  const privacy = dist.privacy || 'unlisted';
  const title = dist.title || manifest.episode;

  const plan = {
    file: fileRel,
    sizeMB: fileAbs && fs.existsSync(fileAbs) ? (fs.statSync(fileAbs).size / 1e6).toFixed(1) : '?',
    title,
    privacy,
    tags: dist.tags || [],
    thumbnail: dist.thumbnail || null,
    srt: dist.srt || null,
    short: !!dist.short,
  };

  // Already published? idempotent.
  if (dist.video_id && !opts.force) {
    console.log(`  ↻ YouTube already published: ${dist.url || dist.video_id}`);
    return { status: 'skipped:done', video_id: dist.video_id, url: dist.url };
  }

  if (!live) {
    console.log('  ▶ [DRY-RUN] YouTube — would upload:');
    console.log('        ' + JSON.stringify(plan));
    console.log('        (quota cost ≈1600 units. set SOCIAL_PUBLISH=1 to go live.)');
    return { status: 'dry-run', plan };
  }

  if (!haveCreds()) {
    console.warn(`  ⚠ YouTube live requested but ${YT_ENV.join('/')} not set — skipping.`);
    return { status: 'skipped:no-creds' };
  }
  if (!fileAbs || !fs.existsSync(fileAbs)) {
    console.warn(`  ⚠ YouTube: video file missing (${fileRel}) — skipping.`);
    return { status: 'skipped:no-file' };
  }

  let google;
  try {
    ({ google } = require('googleapis'));
  } catch {
    console.warn('  ⚠ googleapis not installed. `npm i googleapis` to enable live YouTube upload. Skipping.');
    return { status: 'skipped:no-dep' };
  }

  const oauth2 = new google.auth.OAuth2(process.env.YT_CLIENT_ID, process.env.YT_CLIENT_SECRET);
  oauth2.setCredentials({ refresh_token: process.env.YT_REFRESH_TOKEN });
  const yt = google.youtube({ version: 'v3', auth: oauth2 });

  const description = dist.description || '';
  const tags = plan.short ? [...plan.tags, 'Shorts'] : plan.tags;

  console.log(`  ▶ YouTube upload (${plan.sizeMB}MB, privacy=${privacy})…`);
  const res = await yt.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: { title, description, tags, categoryId: '22' },
      status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
    },
    media: { body: fs.createReadStream(fileAbs) },
  });
  const videoId = res.data.id;
  const url = `https://youtu.be/${videoId}`;

  // Thumbnail (custom thumbnails require a verified channel).
  if (dist.thumbnail) {
    const thumbAbs = path.join(epDir, dist.thumbnail);
    if (fs.existsSync(thumbAbs)) {
      try {
        await yt.thumbnails.set({ videoId, media: { body: fs.createReadStream(thumbAbs) } });
      } catch (e) { console.warn(`  ⚠ thumbnail set failed: ${e.message}`); }
    }
  }
  // Captions sidecar.
  if (dist.srt) {
    const srtAbs = path.join(epDir, dist.srt);
    if (fs.existsSync(srtAbs)) {
      try {
        await yt.captions.insert({
          part: ['snippet'],
          requestBody: { snippet: { videoId, language: 'en', name: 'English', isDraft: false } },
          media: { body: fs.createReadStream(srtAbs) },
        });
      } catch (e) { console.warn(`  ⚠ caption insert failed: ${e.message}`); }
    }
  }

  dist.video_id = videoId;
  dist.url = url;
  console.log(`  ✓ YouTube: ${url} (${privacy})`);
  if (privacy !== 'private') {
    console.log('    NOTE: if this lands private anyway, your API project is unaudited (see §7.1).');
  }
  return { status: 'published', video_id: videoId, url };
}

module.exports = { publishYouTube };
