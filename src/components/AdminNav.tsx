'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppSwitcher from './AppSwitcher';

const PRIMARY_TABS = [
  { label: 'Attractions', href: '/admin' },
  { label: 'Operations', href: '/admin/operations' },
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
  isAdmin = true,
}: {
  userEmail: string;
  displayName?: string;
  onLogout: () => void;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

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
      {/* Header bar */}
      <div style={{ background: '#111111', borderBottom: '1px solid #2a2a2a', padding: '0 0', height: 56, display: 'flex', alignItems: 'center' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AppSwitcher currentApp="admin" isAdmin={isAdmin} />
            <Link href="/admin" style={{ textDecoration: 'none' }}>
              <h1 style={{ color: '#F1F5F9', fontSize: 15, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>Admin</h1>
            </Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#94A3B8' }}>
            {userEmail && (
              <span title={userEmail} style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#94A3B8' }}>
                {displayName || userEmail}
              </span>
            )}
            <button
              onClick={onLogout}
              className="admin-nav-signout"
              style={{
                background: 'none',
                border: '1px solid #2a2a2a',
                color: '#94A3B8',
                padding: '4px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Nav tabs */}
      <div
        className="scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ background: '#111111', borderBottom: '1px solid #2a2a2a', padding: '0', overflowX: moreOpen ? 'visible' : 'auto', position: 'relative', zIndex: 40 }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 0 }}>
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
                  fontWeight: active ? 600 : 500,
                  padding: '14px 14px',
                  flexShrink: 0,
                  borderBottom: active ? '2px solid #EF4444' : '2px solid transparent',
                  transition: 'color 0.15s, border-color 0.15s',
                }}
              >
                {tab.label}
              </Link>
            );
          })}

          {/* More dropdown — uses fixed positioning to avoid mobile clip */}
          <div ref={moreRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              ref={moreButtonRef}
              onClick={() => {
                if (!moreOpen && moreButtonRef.current) {
                  const r = moreButtonRef.current.getBoundingClientRect();
                  setDropdownPos({ top: r.bottom + 4, left: r.left });
                }
                setMoreOpen((v) => !v);
              }}
              className={`admin-nav-tab ${moreIsActive || moreOpen ? 'admin-nav-tab-active' : ''}`}
              style={{
                border: 'none',
                fontSize: 14,
                fontWeight: (moreIsActive || moreOpen) ? 600 : 500,
                padding: '14px 14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                borderBottom: moreIsActive ? '2px solid #EF4444' : '2px solid transparent',
                transition: 'color 0.15s, border-color 0.15s',
                background: 'transparent',
              }}
            >
              {activeMoreLabel || 'More'}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.5, transform: moreOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {moreOpen && (
              <div style={{
                position: 'fixed',
                top: dropdownPos.top,
                left: dropdownPos.left,
                background: '#111111',
                border: '1px solid #2a2a2a',
                borderRadius: 8,
                padding: '4px 0',
                minWidth: 160,
                zIndex: 9999,
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
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
                        fontWeight: active ? 600 : 400,
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
              <div style={{ width: 1, height: 16, background: '#2a2a2a', margin: '0 8px', flexShrink: 0 }} />

              {EXTERNAL_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-nav-tab"
                  style={{
                    textDecoration: 'none',
                    fontSize: 13,
                    fontWeight: 500,
                    padding: '14px 12px',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    borderBottom: '2px solid transparent',
                  }}
                >
                  {link.label}
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.4 }}>
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
