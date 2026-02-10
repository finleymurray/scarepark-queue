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
    <div className="mb-6 -mx-4 sm:-mx-6">
      {/* Header bar */}
      <div className="bg-[#111] border-b border-[#333] px-5 py-3 flex items-center">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Immersive Core"
            width={120}
            height={36}
            priority
          />
          <h1 className="text-white text-lg font-semibold">Admin</h1>
        </div>
      </div>

      {/* Nav bar */}
      <div className="bg-[#111] border-b border-[#333] px-5 py-2 flex items-center gap-2">
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors
                ${active
                  ? 'bg-[#222] text-white'
                  : 'text-[#aaa] hover:bg-[#222] hover:text-white'
                }`}
            >
              {tab.label}
            </Link>
          );
        })}

        {/* User info — pushed right */}
        <div className="ml-auto flex items-center gap-3">
          {userEmail && (
            <span className="text-[#aaa] text-[13px] truncate max-w-[200px]" title={userEmail}>
              {userEmail}
            </span>
          )}
          <button
            onClick={onLogout}
            className="px-3.5 py-1.5 text-white text-sm font-semibold border border-white/30
                       rounded transition-colors hover:bg-[#222]"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
