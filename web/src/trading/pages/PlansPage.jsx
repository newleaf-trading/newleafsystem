/**
 * PlansPage (/invest/plans) — every committed Plan of Record for the user.
 *
 * Lists the active plan and the paused history, newest first. The only edit
 * permitted is RENAME (the snapshot's envelope/provenance stay frozen). To run a
 * different plan, the investor commits a new one from /invest/projection — that
 * flow pauses the previous active plan, which then shows here as history.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/hooks/useAuth';
import { useAllPlansOfRecord } from '../hooks/usePlanOfRecord';
import { renamePlan } from '../lib/projection/planStore';
import { weekOf } from '../lib/projection/planMath';
import { usd } from '../lib/money';
import styles from './PlansPage.module.css';

function PlanRow({ plan, uid }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(plan.planName);
  const [saving, setSaving] = useState(false);
  const isActive = plan.status === 'active';

  const save = async () => {
    const name = draft.trim();
    if (!name || name === plan.planName) { setEditing(false); return; }
    setSaving(true);
    try {
      await renamePlan({ uid, planId: plan.id, planName: name });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${styles.row} ${isActive ? styles.rowActive : ''}`}>
      <div className={styles.rowHead}>
        {editing ? (
          <div className={styles.renameRow}>
            <input
              className={styles.renameInput}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
              aria-label="Plan name"
              autoFocus
            />
            <button className={styles.renameSave} type="button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            <button className={styles.renameCancel} type="button" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        ) : (
          <div className={styles.name}>
            {plan.planName}
            <button className={styles.editBtn} type="button" onClick={() => { setDraft(plan.planName); setEditing(true); }}>Rename</button>
          </div>
        )}
        <span className={`${styles.badge} ${isActive ? styles.stActive : styles.stPaused}`}>{plan.status}</span>
      </div>

      <div className={styles.meta}>
        <div className={styles.cell}><span className={styles.k}>Started</span><span className={styles.v}>{plan.startDate} · Week {weekOf(plan.startDate)}</span></div>
        <div className={styles.cell}><span className={styles.k}>Capital</span><span className={styles.v}>{usd(plan.capital)}</span></div>
        <div className={styles.cell}><span className={styles.k}>Cadence</span><span className={styles.v}>{plan.tradesPerWeek}/wk</span></div>
        <div className={styles.cell}><span className={styles.k}>Risk / trade</span><span className={styles.v}>{usd(plan.riskCapDollar)}</span></div>
        <div className={styles.cell}><span className={styles.k}>Max loss</span><span className={styles.v}>{usd(plan.maxLossDollar)}</span></div>
      </div>
      <div className={styles.prov}>from {plan.templateId}@v{plan.templateVersion}</div>
    </div>
  );
}

export function PlansPage() {
  const { user } = useAuth();
  const { plans, loading } = useAllPlansOfRecord();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Plan of record</span>
        <h1 className={styles.title}>Your plans</h1>
        <p className={styles.sub}>Your active plan and the history of plans you’ve committed. Rename any plan; commit a new one from the projection page to switch.</p>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading your plans…</div>
      ) : plans.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyTitle}>No plans yet</span>
          <span className={styles.emptySub}>Choose a vetted plan scaled to your capital and make it your plan of record.</span>
          <Link to="/invest/projection" className={styles.cta}>Choose your plan →</Link>
        </div>
      ) : (
        <div className={styles.list}>
          {plans.map((p) => <PlanRow key={p.id} plan={p} uid={user.uid} />)}
        </div>
      )}
    </div>
  );
}
