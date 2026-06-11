'use client';

import { useState, useCallback } from 'react';
import { surface, text, radius } from '@/lib/theme';

export interface ToastMsg {
  id: number;
  kind: 'error' | 'success';
  message: string;
}

/**
 * Minimal toast system for save/error feedback. Use the hook:
 *   const { toasts, pushToast } = useToasts();
 *   ... pushToast('error', 'Failed to save throughput');
 *   <ToastStack toasts={toasts} />
 */
export function useToasts() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const pushToast = useCallback((kind: ToastMsg['kind'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return { toasts, pushToast };
}

export function ToastStack({ toasts }: { toasts: ToastMsg[] }) {
  return (
    <div
      style={{
        position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        zIndex: 2000, display: 'flex', flexDirection: 'column', gap: 8,
        width: 'calc(100% - 40px)', maxWidth: 380, pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            background: surface.card,
            border: `1px solid ${t.kind === 'error' ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.5)'}`,
            borderLeft: `3px solid ${t.kind === 'error' ? '#EF4444' : '#22C55E'}`,
            borderRadius: radius.md,
            padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          <span style={{ color: t.kind === 'error' ? '#F87171' : '#4ADE80', fontSize: 13, fontWeight: 600 }}>
            {t.kind === 'error' ? 'Error' : 'Saved'}
          </span>
          <span style={{ color: text.secondary, fontSize: 13 }}>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

/** Convenience: banner-style inline error block. */
export function InlineError({ message }: { message: string }) {
  return (
    <div
      style={{
        background: 'rgba(239,68,68,0.08)',
        border: `1px solid rgba(239,68,68,0.25)`,
        borderRadius: radius.sm,
        padding: '10px 12px',
      }}
    >
      <p style={{ color: '#FCA5A5', fontSize: 13, margin: 0, textAlign: 'center' }}>{message}</p>
    </div>
  );
}
