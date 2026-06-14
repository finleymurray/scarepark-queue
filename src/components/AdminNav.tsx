'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import AppSwitcher from './AppSwitcher';
import { surface, border, text, accents, radius } from '@/lib/theme';

const PRIMARY_TABS = [
  { label: 'Attractions', href: '/admin' },
  { label: 'Operations', href: '/admin/operations' },
  { label: 'Sign-Off', href: '/admin/signoff' },
  { label: 'Reports', href: '/admin/reports' },
];

type MoreItem = { label: string; href: string };
type MoreSection = { heading: string; items: MoreItem[] };

const MORE_SECTIONS: MoreSection[] = [
  {
    heading: 'Attractions',
    items: [
      { label: 'Attraction Details', href: '/admin/attractions' },
      { label: 'Add Attraction', href: '/admin/attractions/new' },
    ],
  },
  {
    heading: 'Monitoring',
    items: [
      { label: 'Screens', href: '/admin/screens' },
      { label: 'Logs', href: '/admin/logs' },
      { label: 'Incidents', href: '/admin/incidents' },
      { label: 'Alerts', href: '/admin/alerts' },
    ],
  },
  {
    heading: 'Insights',
    items: [{ label: 'Analytics', href: '/admin/analytics' }],
  },
  {
    heading: 'People',
    items: [{ label: 'Users', href: '/admin/users' }],
  },
];

const MORE_TABS: MoreItem[] = MORE_SECTIONS.flatMap((s) => s.items);

// App switching (Control / Sign-Off) now happens via the AppSwitcher logo;
// only the TV Screens directory remains as an external link.
const EXTERNAL_LINKS = [
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
    // Exact match so /admin/attractions/new doesn't also highlight 'Attraction Details'
    if (href === '/admin/attractions') return pathname === '/admin/attractions';
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
      <div style={{ background: surface.card, borderBottom: `1px solid ${border.default}`, padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AppSwitcher currentApp="admin" isAdmin={isAdmin} />
          <a href="/admin" style={{ textDecoration: 'none' }}>
            <h1 style={{ color: text.primary, fontSize: 15, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>Admin</h1>
          </a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: text.secondary }}>
          {userEmail && (
            <span title={userEmail} style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: text.secondary }}>
              {displayName || userEmail}
            </span>
          )}
          <button
            onClick={onLogout}
            className="admin-nav-signout"
            style={{ background: surface.control, border: `1px solid ${border.strong}`, color: text.secondary, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Nav tabs */}
      <div
        className="scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ background: surface.card, borderBottom: `1px solid ${border.default}`, padding: '0', overflowX: moreOpen ? 'visible' : 'auto', position: 'relative', zIndex: 40 }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 0 }}>
          {PRIMARY_TABS.map((tab) => {
            const active = isActive(tab.href);
            return (
              <a
                key={tab.href}
                href={tab.href}
                className={`admin-nav-tab ${active ? 'admin-nav-tab-active' : ''}`}
                style={{
                  textDecoration: 'none',
                  fontSize: 14,
                  fontWeight: active ? 600 : 500,
                  padding: '14px 14px',
                  flexShrink: 0,
                  borderBottom: active ? `2px solid ${accents.admin.base}` : '2px solid transparent',
                  transition: 'color 0.15s, border-color 0.15s',
                }}
              >
                {tab.label}
              </a>
            );
          })}

          {/* More dropdown — uses fixed positioning to avoid mobile clip */}
          <div ref={moreRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              ref={moreButtonRef}
              onClick={() => {
                if (!moreOpen && moreButtonRef.current) {
                  const r = moreButtonRef.current.getBoundingClientRect();
                  // Clamp so dropdown never overflows right edge of screen
                  const left = Math.min(r.left, window.innerWidth - 170);
                  setDropdownPos({ top: r.bottom + 4, left });
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
                borderBottom: moreIsActive ? `2px solid ${accents.admin.base}` : '2px solid transparent',
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
                background: surface.raised,
                border: `1px solid ${border.strong}`,
                borderRadius: radius.sm,
                padding: '4px 0',
                minWidth: 160,
                zIndex: 9999,
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              }}>
                {MORE_SECTIONS.map((section, i) => (
                  <div key={section.heading}>
                    {i > 0 && (
                      <div style={{ height: 1, background: border.default, margin: '4px 0' }} />
                    )}
                    <div
                      style={{
                        padding: '6px 16px 4px',
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: text.muted,
                      }}
                    >
                      {section.heading}
                    </div>
                    {section.items.map((tab) => {
                      const active = isActive(tab.href);
                      return (
                        <a
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
                        </a>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* External links — hidden in standalone PWA mode */}
          {!isStandalone && (
            <>
              <div style={{ width: 1, height: 16, background: border.default, margin: '0 8px', flexShrink: 0 }} />

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
