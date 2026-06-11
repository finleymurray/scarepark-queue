'use client';

import { useState } from 'react';
import NumericKeypad from './NumericKeypad';
import { surface, border, text, radius, accents, type AppKey } from '@/lib/theme';

/**
 * Shared 4-digit PIN entry. No lockout/rate-limiting by design — staff are
 * trusted; a wrong PIN just shows an error and lets them retry immediately.
 *
 * verify() is called with the entered PIN; return true on success.
 */
export default function PinPad({
  app,
  title = 'Enter PIN',
  subtitle,
  verify,
  onCancel,
}: {
  app: AppKey;
  title?: string;
  subtitle?: string;
  verify: (pin: string) => Promise<boolean> | boolean;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const accent = accents[app];

  async function handleDigit(d: string) {
    if (busy || pin.length >= 4) return;
    setError(false);
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      setBusy(true);
      const ok = await verify(next);
      setBusy(false);
      if (!ok) {
        setError(true);
        setPin('');
      }
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: '100%', maxWidth: 320,
          background: surface.card,
          border: `1px solid ${border.default}`,
          borderRadius: radius.xl,
          padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <p style={{ color: text.primary, fontSize: 16, fontWeight: 600, margin: 0 }}>{title}</p>
          {subtitle && <p style={{ color: text.muted, fontSize: 12, marginTop: 4 }}>{subtitle}</p>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 18 }}>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              style={{
                width: 14, height: 14, borderRadius: '50%',
                background: i < pin.length ? accent.base : surface.control,
                border: `1px solid ${i < pin.length ? accent.base : border.strong}`,
                transition: 'background 0.1s',
              }}
            />
          ))}
        </div>

        {error && (
          <p style={{ color: '#F87171', fontSize: 13, textAlign: 'center', marginBottom: 14 }}>
            Incorrect PIN — try again
          </p>
        )}

        <NumericKeypad
          onDigit={handleDigit}
          onDelete={() => { setError(false); setPin((p) => p.slice(0, -1)); }}
          onClear={() => { setError(false); setPin(''); }}
        />

        <button
          type="button"
          onClick={onCancel}
          style={{
            width: '100%', marginTop: 14, padding: '12px 0',
            background: 'transparent', border: `1px solid ${border.default}`,
            borderRadius: radius.md, color: text.muted, fontSize: 14, cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
