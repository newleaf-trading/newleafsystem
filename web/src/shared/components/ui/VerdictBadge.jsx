import styles from './VerdictBadge.module.css';

const VERDICT_MAP = {
  ON_TRACK:       { label: 'On track',       cls: 'onTrack' },
  TAKE_PROFIT:    { label: 'Take profit',    cls: 'profit' },
  MONITOR:        { label: 'Monitor',        cls: 'warn' },
  ACTION_NEEDED:  { label: 'Action needed',  cls: 'action' },
  EXIT:           { label: 'Exit',           cls: 'danger' },
};

export function VerdictBadge({ state, size = 'sm' }) {
  const cfg = VERDICT_MAP[state] || VERDICT_MAP.ON_TRACK;
  return (
    <span className={`${styles.badge} ${styles[cfg.cls]} ${styles[size]}`}>
      {cfg.label}
    </span>
  );
}
