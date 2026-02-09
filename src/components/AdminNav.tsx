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
          <span className="text-white/20 text-lg font-light">|</span>
          <h1 className="text-white text-lg font-semibold">Admin</h1>
        </div>

        <div className="flex items-center gap-3">
          {userEmail && (
            <span className="text-[#666] text-xs truncate max-w-[200px]" title={userEmail}>
              {userEmail}
            </span>
          )}
          <button
            onClick={onLogout}
            className="px-3 py-1.5 bg-white/5 border border-white/10 text-[#999] hover:text-white
                       hover:bg-white/10 rounded-lg text-xs font-medium transition-all"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Tab bar — pill style */}
      <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 text-center px-4 py-2.5 text-sm font-semibold rounded-lg transition-all
                ${active
                  ? 'bg-white text-black shadow-sm'
                  : 'text-[#888] hover:text-white hover:bg-white/[0.06]'
                }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
