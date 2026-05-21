import styles from './Toast.module.css';

const icons = {
  success: '\u2713',
  error: '\u2717',
  warning: '\u26A0',
  info: '\u2139',
};

export function Toast({ children, type = 'success', onDismiss }) {
  return (
    <div className={`${styles.toast} ${styles[type]}`} role="status">
      <span className={styles.icon}>{icons[type]}</span>
      <span className={styles.message}>{children}</span>
      <button className={styles.dismiss} onClick={onDismiss} aria-label="Dismiss">
        &times;
      </button>
    </div>
  );
}
