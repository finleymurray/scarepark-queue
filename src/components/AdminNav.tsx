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
      {/* Header bar */}
      <div className="bg-[#111] border-b border-[#333] rounded-t-lg px-5 py-3 flex items-center justify-between">
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
            <span className="text-[#aaa] text-[13px] truncate max-w-[200px]" title={userEmail}>
              {userEmail}
            </span>
          )}
          <button
            onClick={onLogout}
            className="px-3 py-1 border border-[#555] text-[#aaa] hover:border-[#888] hover:text-white
                       rounded text-xs font-medium transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Nav bar */}
      <div className="bg-[#111] border-b border-[#333] rounded-b-lg px-5 py-2 flex items-center gap-2">
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors
                ${active
                  ? 'bg-[#222] text-white'
                  : 'text-[#aaa] hover:bg-[#222] hover:text-white'
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
