'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { surface, border, text as textTok, radius, microLabel } from '@/lib/theme';

const APPS = [
  {
    id: 'control',
    href: '/control',
    logo: '/logo-control.png',
    name: 'Control',
    description: 'Queue times, dispatch & throughput',
    glow: '59,130,246',
  },
  {
    id: 'signoff',
    href: '/signoff',
    logo: '/logo-signoff.png',
    name: 'Sign-Off',
    description: 'Opening & closing checks, show reports',
    glow: '245,158,11',
  },
  {
    id: 'monitor',
    href: '/monitor',
    logo: '/logo-monitor.png?v=2',
    name: 'Monitor',
    description: 'Maze CCTV, floorplans & safety',
    glow: '22,163,74',
  },
  {
    id: 'admin',
    href: '/admin',
    logo: '/logo-admin.png',
    name: 'Admin',
    description: 'Operations, analytics & management',
    glow: '239,68,68',
  },
] as const;

export default function LandingPage() {
  const [checking, setChecking] = useState(true);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        const { data } = await supabase
          .from('user_roles')
          .select('role')
          .eq('email', session.user.email)
          .single();
        setRole(data?.role ?? null);
      }
      setChecking(false);
    }
    check();
  }, []);

  function handleAppClick(href: string, id: string) {
    // Admin requires admin role — redirect to login if needed.
    // Full page navigations (not router.push) for static-export reliability.
    if (id === 'admin' && role !== 'admin') {
      window.location.href = `/login?next=${href}`;
      return;
    }
    window.location.href = href;
  }

  const visibleApps = APPS.filter((a) => {
    if (a.id === 'admin' && role !== null && role !== 'admin') return false;
    return true;
  });

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', background: surface.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: textTok.faint, fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: surface.page,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '48px 20px',
    }}>
      {/* Wordmark */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="CoreLink" style={{ width: 52, height: 52, objectFit: 'contain', marginBottom: 16 }} />
        <h1 style={{ color: textTok.primary, fontSize: 26, fontWeight: 500, margin: 0, letterSpacing: '-0.02em' }}>CoreLink</h1>
        <p style={{ ...microLabel, marginTop: 8 }}>Operations Platform</p>
        <p style={{ color: textTok.faint, fontSize: 12, marginTop: 6 }}>{today}</p>
      </div>

      {/* App banners — art-washed per-app identity, logo as hero */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 420 }}>
        {visibleApps.map((app) => (
          <button
            key={app.id}
            onClick={() => handleAppClick(app.href, app.id)}
            style={{
              display: 'flex', alignItems: 'center',
              minHeight: 96,
              padding: '18px 22px',
              background: `linear-gradient(105deg, rgba(${app.glow},0.16) 0%, rgba(${app.glow},0.05) 45%, ${surface.card} 100%)`,
              border: `1px solid ${border.default}`,
              borderRadius: 16,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'border-color 0.15s, transform 0.12s',
              gap: 18,
              width: '100%',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = `rgba(${app.glow},0.35)`;
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = border.default;
              e.currentTarget.style.transform = 'none';
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: radius.lg, flexShrink: 0,
              background: `rgba(${app.glow},0.10)`,
              border: `1px solid rgba(${app.glow},0.18)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={app.logo}
                alt={app.name}
                style={{
                  width: 38, height: 38, objectFit: 'contain',
                  filter: `drop-shadow(0 0 10px rgba(${app.glow},0.5))`,
                }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: textTok.primary, fontSize: 17, fontWeight: 600, marginBottom: 3, letterSpacing: '-0.01em' }}>{app.name}</div>
              <div style={{ color: textTok.muted, fontSize: 13, lineHeight: 1.4 }}>{app.description}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: textTok.faint, flexShrink: 0 }} aria-hidden="true">
              <path d="M6 3.5L10.5 8L6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ))}
      </div>

      {/* Sign in link if not authenticated */}
      {role === null && (
        <div style={{ marginTop: 36 }}>
          <a
            href="/login"
            style={{ color: textTok.faint, fontSize: 13, textDecoration: 'none', borderBottom: `1px solid ${border.divider}`, paddingBottom: 2 }}
          >
            Sign in
          </a>
        </div>
      )}
    </div>
  );
}
