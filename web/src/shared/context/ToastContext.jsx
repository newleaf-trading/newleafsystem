import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Toast } from '../components/ui/Toast';

const ToastContext = createContext(null);

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const removeToast = useCallback((id) => {
    clearTimeout(timersRef.current[id]);
    delete timersRef.current[id];
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, opts = {}) => {
    const id = ++idCounter;
    const type = opts.type || 'success';
    const duration = opts.duration ?? (type === 'error' ? 5000 : 3500);

    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      timersRef.current[id] = setTimeout(() => removeToast(id), duration);
    }

    return id;
  }, [removeToast]);

  const toast = useCallback((message, opts) => addToast(message, opts), [addToast]);
  toast.success = (msg, opts) => addToast(msg, { ...opts, type: 'success' });
  toast.error = (msg, opts) => addToast(msg, { ...opts, type: 'error' });
  toast.warning = (msg, opts) => addToast(msg, { ...opts, type: 'warning' });
  toast.info = (msg, opts) => addToast(msg, { ...opts, type: 'info' });

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div aria-live="polite" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
        {toasts.map((t) => (
          <Toast key={t.id} type={t.type} onDismiss={() => removeToast(t.id)}>
            {t.message}
          </Toast>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
