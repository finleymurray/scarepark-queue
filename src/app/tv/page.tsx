'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { resolveLogo, resolveGlowRgb } from '@/lib/logos';
import { surface, border, text as textTok, radius, microLabel, card } from '@/lib/theme';

/* Static park-wide TV views — every path verified against src/app/ */
const TV_SCREENS = [
  { path: '/tv1', name: 'TV1', description: 'Queue times & show times list' },
  { path: '/tv2', name: 'TV2', description: 'Ride banners with scrolling ticker' },
  { path: '/tv2.5', name: 'TV2.5', description: 'Compact 4-up ride banners' },
  { path: '/tv3', name: 'TV3', description: 'Show times with artwork' },
  { path: '/tv3.5', name: 'TV3.5', description: 'Fear rating' },
  { path: '/tv4', name: 'TV4', description: 'Auto-carousel of all TV views' },
  { path: '/tv4.5', name: 'TV4.5', description: 'Lite carousel, Pi-friendly' },
  { path: '/tv5', name: 'TV5', description: 'Glitch logo montage' },
  { path: '/tv-ops', name: 'Operations View', description: 'Live ops dashboard' },
];

interface TvAttraction {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  glow_rgb: string | null;
  attraction_type: string | null;
}

function MonitorIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={textTok.faint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export default function TVHub() {
  const [attractions, setAttractions] = useState<TvAttraction[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function fetchAttractions() {
      const { data, error } = await supabase
        .from('attractions')
        .select('id,name,slug,logo_url,glow_rgb,attraction_type')
        .order('sort_order', { ascending: true });
      if (!cancelled && !error && data) setAttractions(data);
    }
    fetchAttractions();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen" style={{ background: surface.page }}>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 20px 64px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 36 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="CoreLink" width={44} height={44} style={{ width: 44, height: 44, objectFit: 'contain' }} />
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: textTok.primary }}>TV Screens</h1>
            <p style={{ ...microLabel, margin: '4px 0 0' }}>Park displays & queue entrance screens</p>
          </div>
        </div>

        {/* Park screens */}
        <section style={{ marginBottom: 40 }}>
          <div style={{ margin: '0 0 16px' }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', color: textTok.primary }}>Park screens</h2>
            <p style={{ ...microLabel, margin: '3px 0 0' }}>{TV_SCREENS.length} static views</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {TV_SCREENS.map((screen) => (
              <a
                key={screen.path}
                href={screen.path}
                style={{
                  ...card(),
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '16px 16px',
                  textDecoration: 'none',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = border.strong; e.currentTarget.style.background = surface.raised; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = border.default; e.currentTarget.style.background = surface.card; }}
              >
                <div style={{ width: 38, height: 38, borderRadius: radius.md, background: surface.control, border: `1px solid ${border.default}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MonitorIcon color={textTok.secondary} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: textTok.primary, fontSize: 14, fontWeight: 600 }}>{screen.name}</div>
                  <div style={{ color: textTok.muted, fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{screen.description}</div>
                </div>
                <Chevron />
              </a>
            ))}
          </div>
        </section>

        {/* Queue displays */}
        <section style={{ marginBottom: 32 }}>
          <div style={{ margin: '0 0 16px' }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', color: textTok.primary }}>Queue displays</h2>
            <p style={{ ...microLabel, margin: '3px 0 0' }}>Per-attraction entrance screens</p>
          </div>
          {attractions.length === 0 ? (
            <p style={{ color: textTok.faint, fontSize: 13, fontStyle: 'italic', margin: 0 }}>Loading attractions…</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {attractions.map((a) => {
                const logo = resolveLogo(a);
                const glowRgb = resolveGlowRgb(a) || '148, 163, 184';
                return (
                  <a
                    key={a.id}
                    href={`/queue?a=${a.slug}`}
                    style={{
                      ...card(),
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '14px 16px',
                      textDecoration: 'none',
                      background: `linear-gradient(105deg, rgba(${glowRgb}, 0.14) 0%, ${surface.card} 60%)`,
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = border.strong; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = border.default; }}
                  >
                    {logo ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={logo} alt="" width={44} height={44} loading="lazy" decoding="async" style={{ width: 44, height: 44, objectFit: 'contain', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: radius.md, background: surface.control, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <MonitorIcon color={textTok.muted} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: textTok.primary, fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                      <div style={{ ...microLabel, marginTop: 2 }}>
                        {a.attraction_type === 'show' ? 'Show · ' : ''}Queue display
                      </div>
                    </div>
                    <Chevron />
                  </a>
                );
              })}
            </div>
          )}
        </section>

        {/* Footer note */}
        <p style={{ color: textTok.muted, fontSize: 13, margin: 0, paddingTop: 20, borderTop: `1px solid ${border.divider}` }}>
          Screens can also be paired via <a href="/screen" style={{ color: textTok.secondary, textDecoration: 'underline', textUnderlineOffset: 3 }}>/screen</a> with a 4-character code.
        </p>
      </main>
    </div>
  );
}
