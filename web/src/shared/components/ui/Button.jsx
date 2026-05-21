import styles from './Button.module.css';

/**
 * Button variants: primary (dark green), gold, secondary (outline), ghost, danger
 */
export function Button({
  children, variant = 'primary', size = 'md', disabled, loading, onClick, className = '', ...props
}) {
  const classes = [
    styles.btn,
    styles[variant],
    styles[size],
    disabled && styles.disabled,
    loading && styles.loading,
    className,
  ].filter(Boolean).join(' ');

  return (
    <button className={classes} onClick={onClick} disabled={disabled || loading} {...props}>
      {loading ? 'Loading...' : children}
    </button>
  );
}
