'use client';

import { accents, border, radius } from '@/lib/theme';

const accent = accents.monitor;

/**
 * Stand-in CCTV tile — scanline static until the real cameras are installed.
 * Once the NVR exists this becomes a WebRTC <video> with the same chrome.
 */
export default function CamTile({
  label,
  sublabel,
  focused,
  large,
  onClick,
}: {
  label: string;
  sublabel?: string;
  focused?: boolean;
  large?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative', aspectRatio: large ? '16/7' : '16/10', overflow: 'hidden',
        borderRadius: radius.sm, cursor: onClick ? 'pointer' : 'default',
        border: `1px solid ${focused ? accent.base : border.strong}`,
        background: `
          repeating-linear-gradient(0deg, transparent 0 2px, rgba(255,255,255,0.025) 2px 3px),
          radial-gradient(120% 90% at 35% 25%, #1C2029 0%, #12141B 55%, #0A0B10 100%)`,
      }}
    >
      <span style={{
        position: 'absolute', left: 8, top: 6, fontSize: large ? 11 : 10, fontWeight: 600,
        letterSpacing: '0.06em', color: '#CBD5E1', textShadow: '0 1px 2px #000',
        maxWidth: 'calc(100% - 16px)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      {sublabel && (
        <span style={{
          position: 'absolute', left: 8, bottom: 6, fontSize: 9, letterSpacing: '0.05em',
          color: '#64748B', textShadow: '0 1px 2px #000',
        }}>
          {sublabel}
        </span>
      )}
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{
          fontSize: large ? 11 : 8, fontWeight: 700, letterSpacing: '0.14em', color: '#FBBF24',
          border: '1px solid rgba(251,191,36,0.45)', borderRadius: 4, padding: large ? '5px 10px' : '3px 6px',
        }}>
          {large ? 'NO SIGNAL — CAMERA NOT INSTALLED' : 'NO SIGNAL'}
        </span>
      </span>
    </div>
  );
}
