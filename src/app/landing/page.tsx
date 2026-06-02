'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const APPS = [
  {
    id: 'control',
    href: '/control',
    logo: '/logo-control.png',
    name: 'Field Control',
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
      <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#374151', fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#000',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      {/* CoreLink wordmark */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 56 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="CoreLink" style={{ width: 52, height: 52, objectFit: 'contain', marginBottom: 16 }} />
        <h1 style={{ color: '#F1F5F9', fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>CoreLink</h1>
        <p style={{ color: '#374151', fontSize: 13, marginTop: 6 }}>Operations Platform</p>
      </div>

      {/* App cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${visibleApps.length}, 1fr)`,
        gap: 16,
        width: '100%',
        maxWidth: 640,
      }}>
        {visibleApps.map((app) => (
          <button
            key={app.id}
            onClick={() => handleAppClick(app.href, app.id)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '28px 20px',
              background: app.accentBg,
              border: `1px solid ${app.accentBorder}`,
              borderRadius: 16,
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'transform 0.12s, box-shadow 0.12s',
              gap: 14,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = `0 8px 24px ${app.accentBg}`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={app.logo} alt={app.name} style={{ width: 48, height: 48, objectFit: 'contain' }} />
            <div>
              <div style={{ color: '#F1F5F9', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{app.name}</div>
              <div style={{ color: '#64748B', fontSize: 12, lineHeight: 1.4 }}>{app.description}</div>
            </div>
            <div style={{
              marginTop: 4, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
              color: app.accent, padding: '4px 12px',
              background: 'rgba(255,255,255,0.04)', borderRadius: 20,
            }}>
              Open →
            </div>
          </button>
        ))}
      </div>

      {/* Sign in link if not authenticated */}
      {role === null && (
        <div style={{ marginTop: 40 }}>
          <a
            href="/login"
            style={{ color: '#374151', fontSize: 13, textDecoration: 'none', borderBottom: '1px solid #1a1a1a', paddingBottom: 2 }}
          >
            Sign in
          </a>
        </div>
      )}
    </div>
  );
}
