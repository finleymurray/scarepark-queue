'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const PRIMARY_TABS = [
  { label: 'Attractions', href: '/admin' },
  { label: 'Sign-Off', href: '/admin/signoff' },
  { label: 'Reports', href: '/admin/reports' },
];

const MORE_TABS = [
  { label: 'Users', href: '/admin/users' },
  { label: 'Screens', href: '/admin/screens' },
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
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  }

  const moreIsActive = MORE_TABS.some((t) => isActive(t.href));
  const activeMoreLabel = MORE_TABS.find((t) => isActive(t.href))?.label;

  // Detect standalone PWA mode (iOS + Android)
  const [isStandalone, setIsStandalone] = useState(false);
  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!moreOpen) return;
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [moreOpen]);

  return (
    <>
      {/* Header bar — logo, user info & sign out */}
      <div style={{ background: '#111', borderBottom: '1px solid #333', padding: '12px 0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <Image
              src="/logo.png"
              alt="Immersive Core"
              width={36}
              height={36}
              priority
              style={{ width: 36, height: 'auto' }}
            />
            <h1 style={{ color: '#fff', fontSize: 18, fontWeight: 600, margin: 0 }}>Admin</h1>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#aaa' }}>
            {userEmail && (
              <span title={userEmail} style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName || userEmail}
              </span>
            )}
            <button
              onClick={onLogout}
              className="admin-nav-signout"
              style={{
                background: 'none',
                border: '1px solid #555',
                color: '#aaa',
                padding: '4px 10px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
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
        style={{ background: '#111', borderBottom: '1px solid #333', padding: '8px 0', overflowX: moreOpen ? 'visible' : 'auto', position: 'relative', zIndex: 40 }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
          {PRIMARY_TABS.map((tab) => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`admin-nav-tab ${active ? 'admin-nav-tab-active' : ''}`}
                style={{
                  textDecoration: 'none',
                  fontSize: 14,
                  padding: '6px 12px',
                  borderRadius: 6,
                  flexShrink: 0,
                }}
              >
                {tab.label}
              </Link>
            );
          })}

          {/* More dropdown */}
          <div ref={moreRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className={`admin-nav-tab ${moreIsActive || moreOpen ? 'admin-nav-tab-active' : ''}`}
              style={{
                border: 'none',
                fontSize: 14,
                padding: '6px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {activeMoreLabel || 'More'}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.6, transform: moreOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {moreOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: 8,
                padding: '4px 0',
                minWidth: 150,
                zIndex: 50,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                {MORE_TABS.map((tab) => {
                  const active = isActive(tab.href);
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      onClick={() => setMoreOpen(false)}
                      className={`admin-nav-dropdown ${active ? 'admin-nav-dropdown-active' : ''}`}
                      style={{
                        display: 'block',
                        padding: '8px 16px',
                        textDecoration: 'none',
                        fontSize: 14,
                      }}
                    >
                      {tab.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* External links — hidden in standalone PWA mode */}
          {!isStandalone && (
            <>
              <div style={{ width: 1, height: 20, background: '#333', margin: '0 4px', flexShrink: 0 }} />

              {EXTERNAL_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-nav-tab"
                  style={{
                    textDecoration: 'none',
                    fontSize: 14,
                    padding: '6px 12px',
                    borderRadius: 6,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  {link.label}
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.5 }}>
                    <path d="M3.5 1.5H10.5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M10.5 1.5L1.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}
