#!/usr/bin/env node
'use strict';

/**
 * TIQ content validator. Runs over every JSON file in content/tiq/ and enforces
 * the bank invariants from spec-core §4 plus the front-door rules from
 * spec-frontdoor. No-CI decision (docs/tiq deploy topology): this is wired as an
 * npm script and a git pre-commit hook, not a CI job.
 *
 *   node scripts/tiq/validate-bank.js        # exit 1 on any violation
 *
 * Rules (fail the build):
 *   1  duplicate item IDs
 *   2  choice keys not matching scoring keys (weighted_choice)
 *   3  a weighted_choice item without exactly one maximum-scoring choice
 *   4  a gap smaller than 3 points between best and second-best choice
 *      (knowledge-type items only; behavioural EQ items are exempt — spec §1.1
 *       grades their distractors close on purpose, so closeness is design, not
 *       ambiguity)
 *   5  multi_select correct_keys not a subset of choice keys
 *   6  ranking correct_order not equal to the choice key set
 *   7  pair_id appearing an odd number of times
 *   8  front-door consensus percentages not summing to 100
 *   9  any item whose category is not one of KQ/EQ/SQ/RQ/MQ
 *   10 any ruin_flag_choices key not present in the item's choices
 *
 * Rules are applied only where their fields exist, so assessment items,
 * front-door items and scenario files are each checked on the rules that apply.
 */

const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.join(__dirname, '..', '..', 'content', 'tiq');
const CATEGORIES = new Set(['KQ', 'EQ', 'SQ', 'RQ', 'MQ']);

// Behavioural categories are exempt from rule 4 (the best/second-best gap). Their
// distractors are graded close by design (spec-core §1.1: "no free wrong answers"),
// so a small gap is the intended signal, not an ambiguous item. The gap invariant
// is a knowledge-item check.
const BEHAVIOURAL_CATEGORIES = new Set(['EQ']);

const violations = [];
function fail(rule, where, msg) { violations.push({ rule, where, msg }); }

// ── file discovery ───────────────────────────────────────────────────────────

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.endsWith('.json')) out.push(p);
  }
  return out;
}

function choiceKeysOf(item) {
  if (!Array.isArray(item.choices)) return [];
  return item.choices.map(c => (typeof c === 'string' ? c : c.key));
}

// ── item-level rules ─────────────────────────────────────────────────────────

const allIds = [];       // rule 1
const pairCounts = {};   // rule 7

function checkItem(item, where, kind) {
  const id = item.id || '(no id)';
  if (item.id) allIds.push({ id: item.id, where });

  // rule 9 — category must be one of KQ/EQ/SQ/RQ/MQ (assessment items carry one)
  if (item.category !== undefined && !CATEGORIES.has(item.category)) {
    fail(9, `${where} ${id}`, `category "${item.category}" is not one of KQ/EQ/SQ/RQ/MQ`);
  }

  // rule 7 — tally framing pairs
  if (item.pair_id) pairCounts[item.pair_id] = (pairCounts[item.pair_id] || 0) + 1;

  const sc = item.scoring;
  const keys = choiceKeysOf(item);

  // rule 8 — front-door consensus must sum to 100
  if (kind === 'frontdoor' && Array.isArray(item.options)) {
    const sum = item.options.reduce((a, o) => a + (Number(o.consensus) || 0), 0);
    if (sum !== 100) fail(8, `${where} ${id}`, `front-door consensus sums to ${sum}, not 100`);
  }

  if (!sc || !sc.mode) return; // front-door / non-scored items stop here

  // rule 10 — ruin_flag_choices must be real choices
  if (Array.isArray(sc.ruin_flag_choices)) {
    for (const k of sc.ruin_flag_choices) {
      if (!keys.includes(k)) fail(10, `${where} ${id}`, `ruin_flag_choices key "${k}" is not one of the item's choices [${keys.join(',')}]`);
    }
  }

  if (sc.mode === 'weighted_choice') {
    const cp = sc.choice_points || {};
    const cpKeys = Object.keys(cp);

    // rule 2 — choice_points keys must exactly match the choice keys
    const missingPoints = keys.filter(k => !cpKeys.includes(k));
    const orphanPoints = cpKeys.filter(k => !keys.includes(k));
    if (missingPoints.length || orphanPoints.length) {
      fail(2, `${where} ${id}`, `choice/scoring key mismatch — choices without points [${missingPoints.join(',')}], points without a choice [${orphanPoints.join(',')}]`);
    }

    const pts = cpKeys.map(k => cp[k]);
    const max = Math.max(...pts);
    const nAtMax = pts.filter(p => p === max).length;

    // rule 3 — exactly one maximum-scoring choice
    if (nAtMax !== 1) {
      fail(3, `${where} ${id}`, `${nAtMax} choices tie for the maximum score (${max}); expected exactly one`);
    }

    // rule 4 — gap between best and second-best >= 3 (knowledge-type items only)
    if (!BEHAVIOURAL_CATEGORIES.has(item.category)) {
      const sorted = pts.slice().sort((a, b) => b - a);
      if (sorted.length >= 2) {
        const gap = sorted[0] - sorted[1];
        if (gap < 3) fail(4, `${where} ${id}`, `gap between best (${sorted[0]}) and second-best (${sorted[1]}) is ${gap}, under the 3-point minimum`);
      }
    }
  } else if (sc.mode === 'multi_select') {
    // rule 5 — correct_keys subset of choice keys
    for (const k of sc.correct_keys || []) {
      if (!keys.includes(k)) fail(5, `${where} ${id}`, `multi_select correct_key "${k}" is not one of the choices [${keys.join(',')}]`);
    }
  } else if (sc.mode === 'ranking') {
    // rule 6 — correct_order must equal the choice key set
    const order = sc.correct_order || [];
    const a = order.slice().sort();
    const b = keys.slice().sort();
    if (a.length !== b.length || a.some((k, i) => k !== b[i])) {
      fail(6, `${where} ${id}`, `ranking correct_order [${order.join(',')}] does not equal the choice key set [${keys.join(',')}]`);
    }
  }
}

// ── run ──────────────────────────────────────────────────────────────────────

const files = walk(CONTENT_DIR).sort();
let itemCount = 0;

for (const file of files) {
  const rel = path.relative(path.join(__dirname, '..', '..'), file);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    fail(0, rel, `invalid JSON: ${e.message}`);
    continue;
  }

  // scenario files have scripts+nodes, not a bank of scored items — skip item rules
  if (data.scripts && Array.isArray(data.nodes)) continue;

  const kind = /instinct|frontdoor/.test(String(data.bank_id)) || data.type === 'frontdoor' ? 'frontdoor' : 'assessment';
  const items = Array.isArray(data.questions) ? data.questions : [];
  for (const item of items) { checkItem(item, rel, kind); itemCount++; }
}

// rule 1 — duplicate IDs (global across all files)
const seen = {};
for (const { id, where } of allIds) (seen[id] = seen[id] || []).push(where);
for (const [id, wheres] of Object.entries(seen)) {
  if (wheres.length > 1) fail(1, id, `duplicate item ID appears ${wheres.length}× (${[...new Set(wheres)].join(', ')})`);
}

// rule 7 — pair_id odd counts
for (const [pid, count] of Object.entries(pairCounts)) {
  if (count % 2 !== 0) fail(7, pid, `pair_id appears ${count}× (odd — framing pairs must come in twos)`);
}

// ── report ───────────────────────────────────────────────────────────────────

const RULE_NAMES = {
  0: 'invalid JSON',
  1: 'duplicate IDs', 2: 'choice/scoring key mismatch', 3: 'not exactly one max choice',
  4: 'best/second-best gap < 3', 5: 'multi_select correct_keys not a subset',
  6: 'ranking correct_order != choice keys', 7: 'pair_id odd count',
  8: 'front-door consensus != 100', 9: 'category not KQ/EQ/SQ/RQ/MQ', 10: 'ruin_flag_choices key not in choices'
};

console.log(`\nTIQ content validation — ${files.length} file(s), ${itemCount} item(s)\n`);

if (!violations.length) {
  console.log('  ✓ all invariants hold\n');
  process.exit(0);
}

violations.sort((a, b) => a.rule - b.rule);
for (const v of violations) {
  console.log(`  ✗ [rule ${v.rule}: ${RULE_NAMES[v.rule]}]  ${v.where}\n       ${v.msg}`);
}
console.log(`\n  ${violations.length} violation(s)\n`);
process.exit(1);
