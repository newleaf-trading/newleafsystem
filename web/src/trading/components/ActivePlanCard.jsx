/**
 * ActivePlanCard — invest Home card for the user's committed Plan of Record.
 *
 * Phase 1 (spine): shows IDENTITY + the $ ENVELOPE only — plan name, week-of,
 * capital, cadence target, risk per trade, portfolio max loss. It deliberately
 * does NOT compute adherence/attribution (that is Phase 2). All figures are read
 * straight from the frozen snapshot; nothing is recomputed here.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/hooks/useAuth';
import { usePlanOfRecord } from '../hooks/usePlanOfRecord';
import { renamePlan } from '../lib/projection/planStore';
import { weekOf } from '../lib/projection/planMath';
import { usd } from '../lib/money';
import { AdherenceGlance } from './AdherenceGlance';
import styles from './ActivePlanCard.module.css';

export function ActivePlanCard({ showAdherence = true }) {
  const { user } = useAuth();
  const { plan, loading } = usePlanOfRecord();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const startEdit = () => { setDraft(plan.planName); setEditing(true); };
  const saveEdit = async () => {
    const name = draft.trim();
    if (!name || name === plan.planName) { setEditing(false); return; }
    setSaving(true);
    try {
      await renamePlan({ uid: user.uid, planId: plan.id, planName: name });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  if (!plan) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyText}>
          <span className={styles.emptyTitle}>Choose your plan</span>
          <span className={styles.emptySub}>Pick a vetted plan scaled to your capital and make it your plan of record.</span>
        </div>
        <Link to="/invest/projection" className={styles.cta}>Choose your plan →</Link>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div className={styles.headMain}>
          <span className={styles.eyebrow}>Active plan</span>
          {editing ? (
            <div className={styles.renameRow}>
              <input
                className={styles.renameInput}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false); }}
                aria-label="Plan name"
                autoFocus
              />
              <button className={styles.renameSave} type="button" onClick={saveEdit} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button className={styles.renameCancel} type="button" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          ) : (
            <div className={styles.name}>
              {plan.planName}
              <button className={styles.editBtn} type="button" onClick={startEdit} aria-label="Rename plan">Rename</button>
            </div>
          )}
        </div>
        <span className={styles.week}>Week {weekOf(plan.startDate)}</span>
      </div>
      <div className={styles.grid}>
        <div className={styles.stat}>
          <div className={styles.k}>Capital</div>
          <div className={styles.v}>{usd(plan.capital)}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.k}>Cadence target</div>
          <div className={styles.v}>{plan.tradesPerWeek}/wk</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.k}>Risk per trade</div>
          <div className={styles.v}>{usd(plan.riskCapDollar)}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.k}>Portfolio max loss</div>
          <div className={styles.v}>{usd(plan.maxLossDollar)}</div>
        </div>
      </div>
      {showAdherence && <AdherenceGlance />}
      <div className={styles.foot}>
        <Link to="/invest/plans/active" className={styles.footLink}>Plan adherence</Link>
        <Link to="/invest/projection" className={styles.footLink}>Change plan</Link>
        <Link to="/invest/plans" className={styles.footLink}>View all plans →</Link>
      </div>
    </div>
  );
}
