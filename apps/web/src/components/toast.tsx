'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Icon, type IconName } from './ui';
import { cx } from './utils';

type ToastTone = 'info' | 'pass' | 'fail';

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  desc?: string;
}

interface ToastApi {
  push: (toast: { tone?: ToastTone; title: string; desc?: string }) => void;
  success: (title: string, desc?: string) => void;
  error: (title: string, desc?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback<ToastApi['push']>(({ tone = 'info', title, desc }) => {
    const id = nextId++;
    setToasts((prev) => [...prev.slice(-3), { id, tone, title, desc }]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (title, desc) => push({ tone: 'pass', title, desc }),
      error: (title, desc) => push({ tone: 'fail', title, desc }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toaster" role="status" aria-live="polite">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 4500);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  const icon: IconName = toast.tone === 'pass' ? 'check' : toast.tone === 'fail' ? 'x' : 'bell';

  return (
    <div className={cx('toast', `toast--${toast.tone}`)}>
      <span className="toast__icon" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <div className="toast__body">
        <p className="toast__title">{toast.title}</p>
        {toast.desc && <p className="toast__desc">{toast.desc}</p>}
      </div>
      <button type="button" className="toast__close" onClick={onDismiss} aria-label="Dismiss">
        <Icon name="x" />
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
