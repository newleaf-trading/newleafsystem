'use strict';

/**
 * instagram.js — publish adapter for the Instagram Graph API (Reels + Feed video).
 *
 * SAFETY (spec §7.2): this is CONTAINER-ONLY by default. It creates the media
 * container from a public URL and STOPS — it never calls /media_publish unless
 * BOTH opts.live === true AND manifest.distribution.instagram.publish === true.
 * That's deliberate: a Reel's cover/first-frame can't be swapped after posting, so
 * a human eyeballs it before the publish call.
 *
 * Requirements: an IG Business/Creator account linked to a Facebook Page, and a
 * long-lived token. The Graph API FETCHES the video from a public URL itself
 * (polling can take minutes), so we hand it manifest.final.r2_url (publish.js
 * already uploads with CacheControl: public). If your bucket is private, presign
 * with ≥1h TTL — a short presign will race the fetch. Uses global fetch (Node 18+).
 */

const IG_ENV = ['IG_USER_ID', 'IG_ACCESS_TOKEN'];
const GRAPH = 'https://graph.facebook.com/v20.0';

function haveCreds() {
  return IG_ENV.every((k) => process.env[k]);
}

async function graphPost(pathname, params) {
  const body = new URLSearchParams({ ...params, access_token: process.env.IG_ACCESS_TOKEN });
  const res = await fetch(`${GRAPH}/${pathname}`, { method: 'POST', body });
  const json = await res.json();
  if (!res.ok) throw new Error(`IG ${pathname}: ${JSON.stringify(json.error || json)}`);
  return json;
}

async function graphGet(id, fields) {
  const qs = new URLSearchParams({ fields, access_token: process.env.IG_ACCESS_TOKEN });
  const res = await fetch(`${GRAPH}/${id}?${qs}`);
  const json = await res.json();
  if (!res.ok) throw new Error(`IG get ${id}: ${JSON.stringify(json.error || json)}`);
  return json;
}

/**
 * @param {string} epDir  (unused for IG — media comes from the public URL)
 * @param {object} manifest
 * @param {{ live?: boolean }} opts
 */
async function publishInstagram(epDir, manifest, opts = {}) {
  const dist = manifest.distribution && manifest.distribution.instagram;
  if (!dist) return { status: 'skipped:no-config' };

  const mediaUrl = dist.media_url || (manifest.final && manifest.final.r2_url);
  const kind = (dist.kind || 'reel').toLowerCase(); // reel | feed
  const caption = dist.caption || '';
  const plan = { kind, mediaUrl, caption: caption.slice(0, 60) + (caption.length > 60 ? '…' : ''), cover: dist.cover || null };

  const live = opts.live === true;

  if (!live) {
    console.log('  ▶ [DRY-RUN] Instagram — would create container (NOT publish):');
    console.log('        ' + JSON.stringify(plan));
    console.log('        (set SOCIAL_PUBLISH=1 to create the container; publish still needs distribution.instagram.publish=true.)');
    return { status: 'dry-run', plan };
  }
  if (!haveCreds()) {
    console.warn(`  ⚠ Instagram live requested but ${IG_ENV.join('/')} not set — skipping.`);
    return { status: 'skipped:no-creds' };
  }
  if (!mediaUrl || !/^https?:\/\//.test(mediaUrl)) {
    console.warn(`  ⚠ Instagram: need a PUBLIC https media URL (got ${mediaUrl}). Publish to R2 first or set media_url. Skipping.`);
    return { status: 'skipped:no-url' };
  }

  // 1) create container
  const containerParams = kind === 'reel'
    ? { media_type: 'REELS', video_url: mediaUrl, caption }
    : { media_type: 'VIDEO', video_url: mediaUrl, caption };
  if (dist.cover_url) containerParams.cover_url = dist.cover_url;

  console.log(`  ▶ Instagram: creating ${kind} container…`);
  const { id: creationId } = await graphPost(`${process.env.IG_USER_ID}/media`, containerParams);

  // 2) poll until FINISHED (can take minutes)
  let statusCode = 'IN_PROGRESS', tries = 0;
  while (statusCode === 'IN_PROGRESS' && tries < 40) {
    await new Promise((r) => setTimeout(r, 5000));
    const s = await graphGet(creationId, 'status_code');
    statusCode = s.status_code;
    tries++;
    if (tries % 4 === 0) console.log(`    …container ${statusCode} (${tries * 5}s)`);
  }
  if (statusCode !== 'FINISHED') {
    console.warn(`  ⚠ Instagram container not ready (status=${statusCode}). Not publishing.`);
    dist.creation_id = creationId;
    return { status: 'container:not-ready', creation_id: creationId };
  }

  dist.creation_id = creationId;

  // 3) publish ONLY if explicitly opted in (per-episode). Otherwise stop here.
  if (dist.publish !== true) {
    console.log(`  ⏸ Instagram container READY (${creationId}). Not published — set distribution.instagram.publish=true to release.`);
    return { status: 'container:ready', creation_id: creationId };
  }
  const pub = await graphPost(`${process.env.IG_USER_ID}/media_publish`, { creation_id: creationId });
  dist.media_id = pub.id;
  console.log(`  ✓ Instagram published: media ${pub.id}`);
  return { status: 'published', media_id: pub.id, creation_id: creationId };
}

module.exports = { publishInstagram };
