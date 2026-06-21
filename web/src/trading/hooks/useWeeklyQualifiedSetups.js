/**
 * useWeeklyQualifiedSetups — read the count of setups that cleared the scanner's
 * quality bar (confidence >= 0.6) for a given ISO week.
 *
 * Phase 2a is READ-ONLY here. The writer is the server-side pipeline (admin SDK)
 * and is DEFERRED — until it populates this collection, `count` is null and the
 * cadence metronome shows "—" rather than fabricating a number.
 *
 * Doc: weeklyQualifiedSetups/{weekId} = { weekId, qualifiedCount, threshold, ... }
 */
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';

/** ISO week id, e.g. "2026-W24". */
export function isoWeekId(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round((d - firstThursday) / (7 * 86_400_000));
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function useWeeklyQualifiedSetups(weekId = isoWeekId()) {
  const [count, setCount] = useState(null); // null = not logged yet → render "—"
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'weeklyQualifiedSetups', weekId),
      (snap) => {
        setCount(snap.exists() ? (snap.data().qualifiedCount ?? null) : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [weekId]);

  return { count, loading };
}
