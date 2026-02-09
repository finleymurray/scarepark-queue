'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

const TABS = [
  { label: 'Attractions', href: '/admin' },
  { label: 'Analytics', href: '/admin/analytics' },
  { label: 'Users', href: '/admin/users' },
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
    <div className="mb-6">
      {/* Header row */}
      <div className="flex items-center justify-between py-4 px-1">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Immersive Core"
            width={120}
            height={36}
            priority
          />
          <span className="text-white/30 text-lg font-light">|</span>
          <h1 className="text-white text-lg font-semibold">Admin</h1>
        </div>

        <div className="flex items-center gap-4">
          {userEmail && (
            <span className="text-[#888] text-xs truncate max-w-[200px]" title={userEmail}>
              {userEmail}
            </span>
          )}
          <button
            onClick={onLogout}
            className="px-3 py-1.5 bg-transparent border border-[#333] text-[#888] hover:text-white
                       hover:border-[#555] rounded text-sm transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-[#333]">
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-5 py-3 text-sm font-medium transition-colors relative
                ${active
                  ? 'text-white'
                  : 'text-[#888] hover:text-white'
                }`}
            >
              {tab.label}
              {active && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
