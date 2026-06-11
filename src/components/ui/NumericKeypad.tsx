'use client';

import { surface, border, text, radius } from '@/lib/theme';

/**
 * Shared 3×4 numeric keypad (1-9, clear, 0, delete).
 * Replaces the four near-identical keypads in Control, Sign-Off and ShowReportModal.
 */
export default function NumericKeypad({
  onDigit,
  onDelete,
  onClear,
  buttonHeight = 56,
}: {
  onDigit: (d: string) => void;
  onDelete: () => void;
  onClear: () => void;
  buttonHeight?: number;
}) {
  const keyStyle: React.CSSProperties = {
    height: buttonHeight,
    background: surface.control,
    border: `1px solid ${border.strong}`,
    borderRadius: radius.md,
    color: text.primary,
    fontSize: 20,
    fontWeight: 500,
    cursor: 'pointer',
    touchAction: 'manipulation',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
        <button key={d} type="button" style={keyStyle} onClick={() => onDigit(d)}>
          {d}
        </button>
      ))}
      <button type="button" style={{ ...keyStyle, color: text.muted, fontSize: 13 }} onClick={onClear}>
        CLR
      </button>
      <button type="button" style={keyStyle} onClick={() => onDigit('0')}>
        0
      </button>
      <button type="button" style={{ ...keyStyle, color: text.muted, fontSize: 13 }} onClick={onDelete}>
        DEL
      </button>
    </div>
  );
}
