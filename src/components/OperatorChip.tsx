'use client';

import { useEffect, useRef, useState } from 'react';
import { surface, border, text, accents, radius, microLabel } from '@/lib/theme';
import PinPad from '@/components/ui/PinPad';
import type { OperatorSession } from '@/types/database';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

/**
 * Header chip showing who's operating the selected attraction.
 * No session → dashed muted pill. Active → green-tinted pill with avatar,
 * tapping opens a small menu (change operator / end shift).
 */
export default function OperatorChip({
  session,
  attractionName,
  verifyPin,
  onEndShift,
}: {
  session: OperatorSession | null;
  attractionName: string;
  verifyPin: (pin: string) => Promise<boolean>;
  onEndShift: () => Promise<void> | void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Outside-click closes the menu
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent | TouchEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [menuOpen]);

  if (!session) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '5px 12px', borderRadius: radius.pill,
        background: surface.control, border: `1px dashed ${border.strong}`,
        color: text.muted, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" /><path d="M4 21v-1a8 8 0 0 1 16 0v1" />
        </svg>
        No operator
      </span>
    );
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setMenuOpen((v) => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '4px 10px 4px 4px', borderRadius: radius.pill,
          background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.30)',
          color: '#4ADE80', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          whiteSpace: 'nowrap', touchAction: 'manipulation',
        }}
      >
        <span style={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          background: accents.control.strong, color: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 700, letterSpacing: '0.02em',
        }}>
          {initials(session.operator_name)}
        </span>
        {shortName(session.operator_name)}
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.7, transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {menuOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 100,
          width: 200, background: surface.card,
          border: `1px solid ${border.default}`, borderRadius: radius.lg,
          boxShadow: '0 8px 24px rgba(0,0,0,0.45)', overflow: 'hidden',
        }}>
          <div style={{ ...microLabel, padding: '10px 14px 6px', borderBottom: `1px solid ${border.divider}` }}>
            Operator Menu
          </div>
          <button
            onClick={() => { setMenuOpen(false); setPinOpen(true); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '11px 14px', background: 'transparent', border: 'none',
              color: text.primary, fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accents.control.base} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 3l4 4-4 4" /><path d="M20 7H4" /><path d="M8 21l-4-4 4-4" /><path d="M4 17h16" />
            </svg>
            Change operator
          </button>
          <button
            onClick={async () => {
              if (!window.confirm(`End ${session.operator_name}'s shift? The panel will lock until a new operator enters their PIN.`)) return;
              setMenuOpen(false);
              await onEndShift();
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '11px 14px', background: 'transparent',
              border: 'none', borderTop: `1px solid ${border.divider}`,
              color: '#F87171', fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" />
            </svg>
            End shift
          </button>
        </div>
      )}

      {pinOpen && (
        <PinPad
          app="control"
          title="Change operator"
          subtitle={attractionName}
          verify={async (pin) => {
            const ok = await verifyPin(pin);
            if (ok) setPinOpen(false);
            return ok;
          }}
          onCancel={() => setPinOpen(false)}
        />
      )}
    </div>
  );
}
