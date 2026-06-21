/**
 * ReviewBadge — review states + freshness states.
 *
 * Review:    time (amber), loss (red), profit (green)
 * Freshness: fresh (green), drifted (amber), breached (red), expired (grey)
 *
 * Props:
 *   review: 'time' | 'loss' | 'profit' | null
 *   freshness: 'fresh' | 'drifted' | 'breached' | 'expired' | null
 *   className?: string
 *
 * Pass either review OR freshness (not both). review takes priority.
 */

import styles from './invest.module.css';

const LABELS = {
  // Review states
  time: 'Time review',
  loss: 'Loss review',
  profit: 'Profit review',
  // Freshness states
  fresh: 'Fresh',
  drifted: 'Drifted',
  breached: 'Breached',
  expired: 'Expired',
};

const CLASSES = {
  // Review states
  time: styles.badgeTime,
  loss: styles.badgeLoss,
  profit: styles.badgeProfit,
  // Freshness states
  fresh: styles.badgeProfit,    // green
  drifted: styles.badgeTime,    // amber
  breached: styles.badgeLoss,   // red
  expired: styles.badgeExpired, // grey
};

export function ReviewBadge({ review, freshness, className = '' }) {
  const key = review || freshness;
  if (!key) return null;
  return (
    <span className={`${styles.badge} ${CLASSES[key] || ''} ${className}`}>
      {LABELS[key] || key}
    </span>
  );
}
