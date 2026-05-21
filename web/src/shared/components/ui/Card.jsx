import styles from './Card.module.css';

export function Card({ children, className = '', onClick, highlight, padding = 'md', ...props }) {
  const classes = [
    styles.card,
    padding === 'sm' ? styles.sm : padding === 'lg' ? styles.lg : styles.md,
    highlight && styles.highlight,
    onClick && styles.clickable,
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} onClick={onClick} {...props}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, sub, color, className = '' }) {
  return (
    <Card className={`${styles.stat} ${className}`} padding="md">
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue} style={color ? { color } : undefined}>{value}</div>
      {sub && <div className={styles.statSub}>{sub}</div>}
    </Card>
  );
}
