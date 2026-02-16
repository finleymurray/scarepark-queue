'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkAuth } from '@/lib/auth';
import AdminNav from '@/components/AdminNav';
import type { ScreenHeartbeat } from '@/types/database';

/* ── Helpers ── */

/** Group screens by their page name (e.g. 'tv4', 'queue-the-bunker') */
function groupByPage(screens: ScreenHeartbeat[]): Record<string, ScreenHeartbeat[]> {
  const groups: Record<string, ScreenHeartbeat[]> = {};
  for (const s of screens) {
    if (!groups[s.page]) groups[s.page] = [];
    groups[s.page].push(s);
  }
  return groups;
}

/** Friendly display name for a page identifier */
function getPageLabel(page: string): string {
  if (page.startsWith('queue-')) {
    const slug = page.replace('queue-', '');
    return slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return page.toUpperCase();
}

/** Page category for grouping in the UI */
function getPageCategory(page: string): 'tv' | 'queue' | 'other' {
  if (page.startsWith('tv')) return 'tv';
  if (page.startsWith('queue-')) return 'queue';
  return 'other';
}

/** How long ago as a friendly string */
function timeAgo(isoString: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (seconds < 10) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/** Status based on last_seen time */
function getStatus(lastSeen: string): 'online' | 'warning' | 'offline' {
  const seconds = (Date.now() - new Date(lastSeen).getTime()) / 1000;
  if (seconds < 60) return 'online';
  if (seconds < 180) return 'warning';
  return 'offline';
}

const statusColors = {
  online: { bg: '#22C55E', text: '#22C55E', label: 'Online' },
  warning: { bg: '#F59E0B', text: '#F59E0B', label: 'Stale' },
  offline: { bg: '#EF4444', text: '#EF4444', label: 'Offline' },
};

/* ── Styles ── */

const cardStyle: React.CSSProperties = {
  background: '#1E1E1E',
  border: '1px solid #2a2a2a',
  borderRadius: 14,
  padding: 20,
};

const statCardStyle: React.CSSProperties = {
  ...cardStyle,
  textAlign: 'center',
  padding: '16px 12px',
  flex: '1 1 0',
  minWidth: 100,
};

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: '#666',
  marginBottom: 12,
  paddingBottom: 8,
  borderBottom: '1px solid #2a2a2a',
};

/* ── Page Component ── */

export default function ScreensPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [screens, setScreens] = useState<ScreenHeartbeat[]>([]);
  const [now, setNow] = useState(Date.now());

  const fetchScreens = useCallback(async () => {
    const { data, error } = await supabase
      .from('screen_heartbeats')
      .select('*')
      .order('last_seen', { ascending: false });

    if (!error && data) {
      setScreens(data);
    }
  }, []);

  useEffect(() => {
    async function init() {
      const auth = await checkAuth();
      if (!auth.authenticated || auth.role !== 'admin') {
        router.push('/login');
        return;
      }
      setUserEmail(auth.email || '');
      setDisplayName(auth.displayName || '');

      await fetchScreens();
      setLoading(false);
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Refresh screen data every 15 seconds
  useEffect(() => {
    if (loading) return;

    const dataInterval = setInterval(fetchScreens, 15000);
    const clockInterval = setInterval(() => setNow(Date.now()), 5000);

    return () => {
      clearInterval(dataInterval);
      clearInterval(clockInterval);
    };
  }, [loading, fetchScreens]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white/60 text-lg">Loading...</div>
      </div>
    );
  }

  const grouped = groupByPage(screens);
  const pageNames = Object.keys(grouped).sort((a, b) => {
    const catA = getPageCategory(a);
    const catB = getPageCategory(b);
    if (catA !== catB) {
      const order = { tv: 0, queue: 1, other: 2 };
      return order[catA] - order[catB];
    }
    return a.localeCompare(b, undefined, { numeric: true });
  });

  // Stats
  const totalScreens = screens.length;
  const onlineCount = screens.filter((s) => getStatus(s.last_seen) === 'online').length;
  const warningCount = screens.filter((s) => getStatus(s.last_seen) === 'warning').length;
  const offlineCount = screens.filter((s) => getStatus(s.last_seen) === 'offline').length;
  const uniquePages = new Set(screens.map((s) => s.page)).size;

  // Group page names by category for section rendering
  const tvPages = pageNames.filter((p) => getPageCategory(p) === 'tv');
  const queuePages = pageNames.filter((p) => getPageCategory(p) === 'queue');
  const otherPages = pageNames.filter((p) => getPageCategory(p) === 'other');

  return (
    <div className="min-h-screen bg-black text-white">
      <AdminNav userEmail={userEmail} displayName={displayName} onLogout={handleLogout} />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Screen Monitor</h2>
          <p style={{ fontSize: 14, color: '#888', marginTop: 4, marginBottom: 0 }}>
            Live status of all connected displays. Screens send a heartbeat every 30 seconds.
          </p>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={statCardStyle}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>{totalScreens}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Devices</div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#22C55E' }}>{onlineCount}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Online</div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#F59E0B' }}>{warningCount}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Stale</div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#EF4444' }}>{offlineCount}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Offline</div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#8B5CF6' }}>{uniquePages}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Unique Pages</div>
          </div>
        </div>

        {screens.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📺</div>
            <p style={{ color: '#888', fontSize: 15, marginBottom: 4 }}>No screens detected yet</p>
            <p style={{ color: '#555', fontSize: 13 }}>
              Screens will appear here once they load and start sending heartbeat pings.
            </p>
          </div>
        ) : (
          <>
            {/* TV Screens Section */}
            {tvPages.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div style={sectionHeaderStyle}>TV Displays</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                  {tvPages.map((page) => (
                    <PageCard key={page} page={page} devices={grouped[page]} now={now} />
                  ))}
                </div>
              </div>
            )}

            {/* Queue Screens Section */}
            {queuePages.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div style={sectionHeaderStyle}>Queue Entrance Displays</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                  {queuePages.map((page) => (
                    <PageCard key={page} page={page} devices={grouped[page]} now={now} />
                  ))}
                </div>
              </div>
            )}

            {/* Other Section */}
            {otherPages.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div style={sectionHeaderStyle}>Other</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                  {otherPages.map((page) => (
                    <PageCard key={page} page={page} devices={grouped[page]} now={now} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* SQL setup note */}
        <div style={{ marginTop: 32, padding: '16px 20px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, fontSize: 12, color: '#666' }}>
          <strong style={{ color: '#888' }}>Supabase Table Required</strong>
          <p style={{ margin: '6px 0 0' }}>
            This page reads from the <code style={{ background: '#2a2a2a', padding: '1px 5px', borderRadius: 3 }}>screen_heartbeats</code> table.
            If the table doesn&apos;t exist yet, create it in Supabase with columns: <code style={{ background: '#2a2a2a', padding: '1px 5px', borderRadius: 3 }}>screen_id</code> (text, primary key),{' '}
            <code style={{ background: '#2a2a2a', padding: '1px 5px', borderRadius: 3 }}>page</code> (text),{' '}
            <code style={{ background: '#2a2a2a', padding: '1px 5px', borderRadius: 3 }}>last_seen</code> (timestamptz),{' '}
            <code style={{ background: '#2a2a2a', padding: '1px 5px', borderRadius: 3 }}>user_agent</code> (text, nullable).
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Page Card Component ── */

function PageCard({
  page,
  devices,
  now,
}: {
  page: string;
  devices: ScreenHeartbeat[];
  now: number;
}) {
  // Sort devices: online first, then by last_seen desc
  const sorted = [...devices].sort((a, b) => {
    const statusA = getStatus(a.last_seen);
    const statusB = getStatus(b.last_seen);
    const order = { online: 0, warning: 1, offline: 2 };
    if (order[statusA] !== order[statusB]) return order[statusA] - order[statusB];
    return new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime();
  });

  // Overall status = worst status across all devices
  const statuses = sorted.map((d) => getStatus(d.last_seen));
  const overallStatus = statuses.includes('offline')
    ? 'offline'
    : statuses.includes('warning')
      ? 'warning'
      : 'online';

  const statusInfo = statusColors[overallStatus];
  const label = getPageLabel(page);
  const isQueue = getPageCategory(page) === 'queue';

  return (
    <div style={cardStyle}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Status dot with pulse animation for online */}
          <div style={{ position: 'relative', width: 10, height: 10 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: statusInfo.bg,
              }}
            />
            {overallStatus === 'online' && (
              <div
                style={{
                  position: 'absolute',
                  inset: -3,
                  borderRadius: '50%',
                  background: statusInfo.bg,
                  opacity: 0.3,
                  animation: 'pulse-ring 2s ease-out infinite',
                }}
              />
            )}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
              {isQueue ? `🎢 ${label}` : `📺 ${label}`}
            </div>
            <div style={{ fontSize: 11, color: '#666' }}>/{page.replace('queue-', 'queue/')}</div>
          </div>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: 6,
            background: `${statusInfo.bg}15`,
            color: statusInfo.text,
            border: `1px solid ${statusInfo.bg}30`,
          }}
        >
          {statusInfo.label}
        </span>
      </div>

      {/* Device list */}
      {sorted.map((device) => {
        const devStatus = getStatus(device.last_seen);
        const devInfo = statusColors[devStatus];
        const deviceShortId = device.screen_id.split('-').pop() || device.screen_id;

        return (
          <div
            key={device.screen_id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              background: '#161616',
              borderRadius: 8,
              marginBottom: 4,
              fontSize: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: devInfo.bg,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: '#ccc', fontFamily: 'monospace', fontSize: 11 }}>
                {device.screen_id}
              </span>
            </div>
            <span style={{ color: '#666', fontSize: 11 }}>
              {timeAgo(device.last_seen)}
            </span>
          </div>
        );
      })}

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.3; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
