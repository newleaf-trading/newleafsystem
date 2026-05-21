import styles from './EmptyState.module.css';
import { Button } from './Button';

export function EmptyState({ icon = '\u{1F331}', title, message, actionLabel, onAction }) {
  return (
    <div className={styles.empty}>
      <div className={styles.icon}>{icon}</div>
      <h3 className={styles.title}>{title}</h3>
      {message && <p className={styles.message}>{message}</p>}
      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  );
}
