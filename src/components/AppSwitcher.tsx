'use client';

import { useState, useRef, useEffect } from 'react';

interface App {
  id: string;
  label: string;
  sublabel: string;
  href: string;
  logo: string;
  accent: string;
}

const APPS: App[] = [
  { id: 'control',  label: 'Control', sublabel: 'Queue & throughput',  href: '/control',  logo: '/logo-control.png',  accent: '#3B82F6' },
  { id: 'signoff',  label: 'Sign-Off',       sublabel: 'Checklists & reports', href: '/signoff',  logo: '/logo-signoff.png',  accent: '#F59E0B' },
  { id: 'admin',    label: 'Admin',           sublabel: 'Management & ops',    href: '/admin',    logo: '/logo-admin.png',    accent: '#EF4444' },
];

export default function AppSwitcher({
  currentApp,
  isAdmin = false,
}: {
  currentApp: 'control' | 'signoff' | 'admin';
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const visibleApps = APPS.filter((a) => {
    if (a.id === 'admin' && !isAdmin) return false;
    return true;
  });

  const current = APPS.find((a) => a.id === currentApp)!;
  const others = visibleApps.filter((a) => a.id !== currentApp);

  if (others.length === 0) {
    // Just show the logo with no switcher
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={current.logo} alt={current.label} style={{ width: 28, height: 28, objectFit: 'contain' }} />
    );
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
          cursor: 'pointer', padding: '4px 6px 4px 0', borderRadius: 8,
          transition: 'opacity 0.15s',
        }}
        title="Switch app"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.logo} alt={current.label} style={{ width: 28, height: 28, objectFit: 'contain' }} />
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{ color: '#64748B', transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}
        >
          <path d="M2 4.5L6 8.5L10 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          minWidth: 220,
          background: '#111',
          border: '1px solid #2a2a2a',
          borderRadius: 12,
          padding: 6,
          zIndex: 9999,
          boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
        }}>
          {/* Current app — dimmed header */}
          <div style={{ padding: '8px 10px 6px', marginBottom: 2 }}>
            <p style={{ color: '#374151', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              Current
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.logo} alt="" style={{ width: 22, height: 22, objectFit: 'contain', opacity: 0.4 }} />
              <span style={{ color: '#374151', fontSize: 13, fontWeight: 600 }}>{current.label}</span>
            </div>
          </div>

          <div style={{ height: 1, background: '#1a1a1a', margin: '4px 0' }} />

          {/* Other apps */}
          {others.map((app) => (
            <a
              key={app.id}
              href={app.href}
              onClick={() => setOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 10px', borderRadius: 8, textDecoration: 'none',
                transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#1a1a1a'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={app.logo} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
              <div>
                <div style={{ color: '#F1F5F9', fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{app.label}</div>
                <div style={{ color: '#64748B', fontSize: 11, marginTop: 1 }}>{app.sublabel}</div>
              </div>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: '#374151', marginLeft: 'auto', flexShrink: 0 }}>
                <path d="M3 2H10V9M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
