'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

const TABS = [
  { label: 'Attractions', href: '/admin' },
  { label: 'Analytics', href: '/admin/analytics' },
  { label: 'Users', href: '/admin/users' },
  { label: 'Field Control', href: '/control' },
];

export default function AdminNav({
  userEmail,
  onLogout,
}: {
  userEmail: string;
  onLogout: () => void;
}) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Header bar — matches people.immersivecore.network */}
      <div style={{ background: '#111', borderBottom: '1px solid #333', padding: '12px 0' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center' }}>
          <a href="/admin" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <Image
              src="/logo.png"
              alt="Immersive Core"
              width={32}
              height={32}
              priority
              style={{ width: 32, height: 'auto' }}
            />
            <h1 style={{ color: '#fff', fontSize: 18, fontWeight: 600, margin: 0 }}>Admin</h1>
          </a>
        </div>
      </div>

      {/* Nav bar — matches people.immersivecore.network */}
      <div style={{ background: '#111', borderBottom: '1px solid #333', padding: '8px 0' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center' }}>
          {TABS.map((tab) => {
            const active = isActive(tab.href);
            return (
              <Link
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
              </Link>
            );
          })}

          {/* User info — pushed right */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#aaa' }}>
            {userEmail && (
              <span title={userEmail}>
                {userEmail}
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
    </>
  );
}
