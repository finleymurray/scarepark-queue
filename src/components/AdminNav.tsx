'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';

const TABS = [
  { label: 'Attractions', href: '/admin' },
  { label: 'Sign-Off', href: '/admin/signoff' },
  { label: 'Users', href: '/admin/users' },
  { label: 'Analytics', href: '/admin/analytics' },
  { label: 'Logs', href: '/admin/logs' },
];

const EXTERNAL_LINKS = [
  { label: 'Field Control', href: '/control' },
  { label: 'Sign-Off', href: '/signoff' },
  { label: 'TV Screens', href: '/tv' },
];

export default function AdminNav({
  userEmail,
  displayName,
  onLogout,
}: {
  userEmail: string;
  displayName?: string;
  onLogout: () => void;
}) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Header bar — logo, user info & sign out */}
      <div style={{ background: '#111', borderBottom: '1px solid #333', padding: '12px 0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/admin" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <Image
              src="/logo.png"
              alt="Immersive Core"
              width={36}
              height={36}
              priority
              style={{ width: 36, height: 'auto' }}
            />
            <h1 style={{ color: '#fff', fontSize: 18, fontWeight: 600, margin: 0 }}>Admin</h1>
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#aaa' }}>
            {userEmail && (
              <span title={userEmail} style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName || userEmail}
              </span>
            )}
            <button
              onClick={onLogout}
              style={{
                background: 'none',
                border: '1px solid #555',
                color: '#aaa',
                padding: '4px 10px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#888';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#555';
                e.currentTarget.style.color = '#aaa';
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Nav tabs — horizontally scrollable on mobile */}
      <div
        className="scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ background: '#111', borderBottom: '1px solid #333', padding: '8px 0', overflowX: 'auto' }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
          {TABS.map((tab) => {
            const active = isActive(tab.href);
            return (
              <a
                key={tab.href}
                href={tab.href}
                style={{
                  color: active ? '#fff' : '#aaa',
                  textDecoration: 'none',
                  fontSize: 14,
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: active ? '#222' : 'transparent',
                  transition: 'background 0.2s, color 0.2s',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = '#222';
                    e.currentTarget.style.color = '#fff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#aaa';
                  }
                }}
              >
                {tab.label}
              </a>
            );
          })}

          {/* Separator */}
          <div style={{ width: 1, height: 20, background: '#333', margin: '0 4px', flexShrink: 0 }} />

          {EXTERNAL_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#aaa',
                textDecoration: 'none',
                fontSize: 14,
                padding: '6px 12px',
                borderRadius: 6,
                background: 'transparent',
                transition: 'background 0.2s, color 0.2s',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#222';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#aaa';
              }}
            >
              {link.label}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.5 }}>
                <path d="M3.5 1.5H10.5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10.5 1.5L1.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          ))}
        </div>
      </div>
    </>
  );
}
