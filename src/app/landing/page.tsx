'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { surface, text as textTok, radius } from '@/lib/theme';

const APPS = [
  {
    id: 'control',
    href: '/control',
    logo: '/logo-control.png',
    name: 'Control',
    description: 'Manage queue times, dispatch groups, log throughput',
    accent: '#3B82F6',
    accentBg: 'rgba(59,130,246,0.08)',
    accentBorder: 'rgba(59,130,246,0.2)',
  },
  {
    id: 'signoff',
    href: '/signoff',
    logo: '/logo-signoff.png',
    name: 'Sign-Off',
    description: 'Opening & closing checklists, show reports',
    accent: '#F59E0B',
    accentBg: 'rgba(245,158,11,0.08)',
    accentBorder: 'rgba(245,158,11,0.2)',
  },
  {
    id: 'admin',
    href: '/admin',
    logo: '/logo-admin.png',
    name: 'Admin',
    description: 'Attractions, users, analytics, operations',
    accent: '#EF4444',
    accentBg: 'rgba(239,68,68,0.08)',
    accentBorder: 'rgba(239,68,68,0.2)',
  },
] as const;

export default function LandingPage() {
  const router = useRouter();
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
    // Admin requires admin role — redirect to login if needed
    if (id === 'admin' && role !== 'admin') {
      router.push(`/login?next=${href}`);
      return;
    }
    router.push(href);
  }

  const visibleApps = APPS.filter((a) => {
    if (a.id === 'admin' && role !== null && role !== 'admin') return false;
    return true;
  });

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
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      {/* CoreLink wordmark */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 48 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="CoreLink" style={{ width: 56, height: 56, objectFit: 'contain', marginBottom: 18 }} />
        <h1 style={{ color: textTok.primary, fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>CoreLink</h1>
        <p style={{ color: textTok.faint, fontSize: 14, marginTop: 6 }}>Operations Platform</p>
      </div>

      {/* App cards — single column on mobile, side-by-side on wider screens */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        width: '100%',
        maxWidth: 420,
      }}>
        {visibleApps.map((app) => (
          <button
            key={app.id}
            onClick={() => handleAppClick(app.href, app.id)}
            style={{
              display: 'flex', alignItems: 'center',
              padding: '20px 24px',
              background: app.accentBg,
              border: `1px solid ${app.accentBorder}`,
              borderRadius: radius.xl,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'transform 0.12s, box-shadow 0.12s',
              gap: 18,
              width: '100%',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = `0 8px 24px ${app.accentBg}`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={app.logo} alt={app.name} style={{ width: 44, height: 44, objectFit: 'contain', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: textTok.primary, fontSize: 17, fontWeight: 700, marginBottom: 3 }}>{app.name}</div>
              <div style={{ color: textTok.muted, fontSize: 13, lineHeight: 1.4 }}>{app.description}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: app.accent, flexShrink: 0 }}>
              <path d="M3 8H13M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        ))}
      </div>

      {/* Sign in link if not authenticated */}
      {role === null && (
        <div style={{ marginTop: 40 }}>
          <a
            href="/login"
            style={{ color: textTok.faint, fontSize: 13, textDecoration: 'none', borderBottom: '1px solid #181B21', paddingBottom: 2 }}
          >
            Sign in
          </a>
        </div>
      )}
    </div>
  );
}
