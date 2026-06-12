'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Shared TV footer strip. Brand text + social handle are editable in
 * Admin → Screens (park_settings keys tv_brand_text / tv_social_handle).
 * Park closes is rendered as a distinct, clearer element separated from
 * the marketing text.
 */
export const TV_BRAND_DEFAULT = 'Immersive Core · Fright Nights';
export const TV_HANDLE_DEFAULT = '@immersivecore';

export function useTvBranding(): { brand: string; handle: string } {
  const [brand, setBrand] = useState(TV_BRAND_DEFAULT);
  const [handle, setHandle] = useState(TV_HANDLE_DEFAULT);

  useEffect(() => {
    let disposed = false;
    async function fetchBranding() {
      const { data } = await supabase
        .from('park_settings')
        .select('key,value')
        .in('key', ['tv_brand_text', 'tv_social_handle']);
      if (disposed || !data) return;
      for (const row of data) {
        if (row.key === 'tv_brand_text' && row.value) setBrand(row.value);
        if (row.key === 'tv_social_handle' && row.value) setHandle(row.value);
      }
    }
    fetchBranding();
    return () => { disposed = true; };
  }, []);

  return { brand, handle };
}

export default function TvFooter({
  closeTime,
  center,
}: {
  /** "22:00" / "10:00 PM" style string, or null to hide */
  closeTime?: string | null;
  /** Optional centre slot text (e.g. 'Share your screams · #ImmersiveCore') */
  center?: string | null;
}) {
  const { brand, handle } = useTvBranding();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '2vw',
        padding: '1.1vh 2.2vw',
        borderTop: '1px solid #15181E',
        background: 'rgba(0,0,0,0.35)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1.6vw', minWidth: 0 }}>
        <span style={{ color: '#64748B', fontSize: '1.5vh', fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          {brand}
        </span>
        <span style={{ color: '#334155', fontSize: '1.4vh', letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>
          {handle}
        </span>
      </div>

      {center && (
        <span style={{ color: '#475569', fontSize: '1.4vh', letterSpacing: '0.18em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {center}
        </span>
      )}

      {closeTime && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.6vw',
            padding: '0.7vh 1.2vw',
            borderRadius: 999,
            background: 'rgba(245,158,11,0.10)',
            border: '1px solid rgba(245,158,11,0.30)',
            color: '#FCD34D',
            fontSize: '1.6vh',
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          Park closes {closeTime}
        </span>
      )}
    </div>
  );
}
