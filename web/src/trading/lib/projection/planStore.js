/**
 * planStore — Firestore writes for the Plan-of-Record spine.
 *
 * Two collections (see firestore.rules):
 *   planTemplates/{id}            operator-owned, versioned, admin-write
 *   users/{uid}/planOfRecord/{id} investor-owned, FROZEN snapshot, owner-write
 *
 * Provenance is stamped on every write to match the discipline used by
 * generaterecommendations (source + serverTimestamp + writer identity). No
 * projection maths live here — derived figures come from planMath/engine.
 */
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { deriveEvPerTrade, buildPlanOfRecord } from './planMath';

const TEMPLATES = 'planTemplates';

const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Publish a template from the operator's current engine state.
 * @param state  engine state ({ wr, aw, al, capPct, tpy } in fractions/counts)
 * @param user   the authenticated operator (uid/email stamped as provenance)
 */
export async function publishTemplate({ name, version, state, portfolioMaxLossPct, user }) {
  const template = {
    name,
    version,
    status: 'published',
    winRateTarget: state.wr,
    avgWin: state.aw,
    avgLoss: state.al,
    tradesPerWeek: Number((state.tpy / 52).toFixed(2)),
    riskCapPct: state.capPct,
    portfolioMaxLossPct,
  };
  const id = `tmpl_${slug(name)}_v${version}`;
  await setDoc(doc(db, TEMPLATES, id), {
    ...template,
    evPerTrade: deriveEvPerTrade(template), // DERIVED — never hand-entered
    createdAt: serverTimestamp(),
    publishedAt: serverTimestamp(),
    provenance: {
      source: 'workbench-projection',
      publishedByUid: user?.uid ?? null,
      publishedByEmail: user?.email ?? null,
      commitSha: null,
    },
  });
  return id;
}

/** Retire a template so investors stop seeing it. Never deletes (snapshots stay valid). */
export async function retireTemplate(id) {
  await updateDoc(doc(db, TEMPLATES, id), { status: 'retired' });
}

/** Highest existing version for a template name (0 if none) — for "new version". */
export function latestVersion(templates, name) {
  return templates
    .filter((t) => t.name === name)
    .reduce((mx, t) => Math.max(mx, t.version || 0), 0);
}

/**
 * Commit an investor's Plan of Record: freeze a snapshot of `template` scaled to
 * `capital`, pausing any currently-active plan first (one active plan per user;
 * prior plans are kept as history).
 */
export async function commitPlanOfRecord({ uid, template, capital, planName }) {
  const col = collection(db, 'users', uid, 'planOfRecord');

  const activeSnap = await getDocs(query(col, where('status', '==', 'active')));
  await Promise.all(activeSnap.docs.map((d) => updateDoc(d.ref, { status: 'paused' })));

  const startDateISO = new Date().toISOString().slice(0, 10);
  const por = buildPlanOfRecord({ template, capital, planName, startDateISO });
  const ref = doc(col);
  await setDoc(ref, { ...por, createdAt: serverTimestamp() });
  return ref.id;
}

/**
 * Rename a committed plan. This is the ONLY in-place edit allowed on a Plan of
 * Record: the display name is presentation, not part of the frozen envelope or
 * provenance, so changing it does not violate the snapshot guarantee.
 */
export async function renamePlan({ uid, planId, planName }) {
  await updateDoc(doc(db, 'users', uid, 'planOfRecord', planId), { planName });
}
