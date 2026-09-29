'use client';

import { CheckCircle2, X, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type ToastKind = 'success' | 'error';
type ToastEntry = { id: number; message: string; kind: ToastKind };

type ToastContextValue = { showToast: (message: string, kind?: ToastKind) => void };
const ToastContext = createContext<ToastContextValue | null>(null);

// Used right before a hard navigation (window.location.href), where the whole
// app — this context included — is torn down and rebuilt from scratch, so an
// in-memory showToast() call would never survive to be seen. Queuing to
// sessionStorage lets the *next* page (any page, since ToastProvider lives in
// the root layout) pick it up once on mount and clear it.
const FLASH_KEY = 'pmc_flash_toast';
export function flashToast(message: string, kind: ToastKind = 'success') {
  try {
    sessionStorage.setItem(FLASH_KEY, JSON.stringify({ message, kind }));
  } catch {
    // sessionStorage unavailable (e.g. private mode edge cases) — safe to skip, non-critical.
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const counter = useRef(0);

  const showToast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, kind }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3800);
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(FLASH_KEY);
      if (raw) {
        sessionStorage.removeItem(FLASH_KEY);
        const { message, kind } = JSON.parse(raw);
        showToast(message, kind);
      }
    } catch {
      // ignore — nothing queued, or storage unavailable
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.kind === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            <span>{t.message}</span>
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)}><X size={13} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
