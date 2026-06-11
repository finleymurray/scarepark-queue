'use client';

import { useEffect, useState } from 'react';

/**
 * Slim banner shown when the browser loses network connectivity, so staff
 * know live data is stale before anything auto-reloads.
 */
export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      style={{
        position: 'sticky', top: 0, zIndex: 500,
        background: 'rgba(245,158,11,0.15)',
        borderBottom: '1px solid rgba(245,158,11,0.35)',
        padding: '8px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B' }} />
      <span style={{ color: '#FCD34D', fontSize: 13, fontWeight: 600 }}>
        Offline — changes won&apos;t save until connection returns
      </span>
    </div>
  );
}
