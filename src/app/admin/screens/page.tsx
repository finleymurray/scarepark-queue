'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkAuth } from '@/lib/auth';
import AdminNav from '@/components/AdminNav';
import type { ScreenHeartbeat, Screen } from '@/types/database';

/* ── Assignable paths ── */

const ASSIGNABLE_PATHS = [
  { value: '', label: 'Unassigned' },
  { value: '/tv1', label: 'TV1 — Mazes & Shows' },
  { value: '/tv2', label: 'TV2 — Ride Banners' },
  { value: '/tv2.5', label: 'TV2.5 — Compact Banners' },
  { value: '/tv3', label: 'TV3 — Show Times' },
  { value: '/tv3.5', label: 'TV3.5 — Fear Rating' },
  { value: '/tv4', label: 'TV4 — Carousel' },
  { value: '/tv5', label: 'TV5 — Glitch Montage' },
  { value: '/queue/the-bunker', label: 'Queue — The Bunker' },
  { value: '/queue/drowned', label: 'Queue — Drowned' },
  { value: '/queue/night-terrors', label: 'Queue — Night Terrors' },
  { value: '/queue/westlake-witch-trials', label: 'Queue — Westlake Witch Trials' },
  { value: '/queue/strings-of-control', label: 'Queue — Strings of Control' },
  { value: '/queue/signal-loss', label: 'Queue — Signal Loss' },
];

/* ── Helpers ── */

function groupByPage(screens: ScreenHeartbeat[]): Record<string, ScreenHeartbeat[]> {
  const groups: Record<string, ScreenHeartbeat[]> = {};
  for (const s of screens) {
    if (!groups[s.page]) groups[s.page] = [];
    groups[s.page].push(s);
  }
  return groups;
}

function getPageLabel(page: string): string {
  if (page.startsWith('queue-')) {
    const slug = page.replace('queue-', '');
    return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  return page.toUpperCase();
}

function getPageCategory(page: string): 'tv' | 'queue' | 'other' {
  if (page.startsWith('tv')) return 'tv';
  if (page.startsWith('queue-')) return 'queue';
  return 'other';
}

function timeAgo(isoString: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (seconds < 10) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

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

const selectStyle: React.CSSProperties = {
  background: '#161616',
  border: '1px solid #2a2a2a',
  borderRadius: 8,
  color: '#ccc',
  fontSize: 13,
  padding: '6px 10px',
  width: '100%',
  outline: 'none',
  cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  background: '#161616',
  border: '1px solid #2a2a2a',
  borderRadius: 8,
  color: '#ccc',
  fontSize: 13,
  padding: '6px 10px',
  width: '100%',
  outline: 'none',
};

const btnStyle: React.CSSProperties = {
  padding: '5px 12px',
  borderRadius: 8,
  border: '1px solid #2a2a2a',
  background: '#161616',
  color: '#aaa',
  fontSize: 12,
  cursor: 'pointer',
  fontWeight: 600,
};

/* ── Page Component ── */

export default function ScreensPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [heartbeats, setHeartbeats] = useState<ScreenHeartbeat[]>([]);
  const [managedScreens, setManagedScreens] = useState<Screen[]>([]);
  const [now, setNow] = useState(Date.now());
  const [showLegacy, setShowLegacy] = useState(false);

  const fetchData = useCallback(async () => {
    const [heartbeatsRes, screensRes] = await Promise.all([
      supabase.from('screen_heartbeats').select('*').order('last_seen', { ascending: false }),
      supabase.from('screens').select('*').order('last_seen', { ascending: false }),
    ]);

    if (!heartbeatsRes.error && heartbeatsRes.data) setHeartbeats(heartbeatsRes.data);
    if (!screensRes.error && screensRes.data) setManagedScreens(screensRes.data);
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

      await fetchData();
      setLoading(false);
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Refresh every 15s + realtime subscription for screens
  useEffect(() => {
    if (loading) return;

    const dataInterval = setInterval(fetchData, 15000);
    const clockInterval = setInterval(() => setNow(Date.now()), 5000);

    // Realtime: live updates for managed screens
    const channel = supabase
      .channel('admin-screens')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'screens' },
        () => {
          // Refetch all on any change
          fetchData();
        },
      )
      .subscribe();

    return () => {
      clearInterval(dataInterval);
      clearInterval(clockInterval);
      supabase.removeChannel(channel);
    };
  }, [loading, fetchData]);

  async function handleAssignPath(screen: Screen, newPath: string) {
    await supabase.from('screens').update({
      assigned_path: newPath || null,
    }).eq('id', screen.id);
  }

  async function handleRenameSreen(screen: Screen, newName: string) {
    await supabase.from('screens').update({
      name: newName || null,
    }).eq('id', screen.id);
  }

  async function handleReload(screen: Screen) {
    const channel = supabase.channel(`screen-cmd-${screen.id}`);
    await channel.subscribe();
    await channel.send({ type: 'broadcast', event: 'reload', payload: {} });
    // Brief delay so the message sends before we clean up
    setTimeout(() => supabase.removeChannel(channel), 1000);
  }

  async function handleRemove(screen: Screen) {
    await supabase.from('screens').delete().eq('id', screen.id);
  }

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

  // Legacy heartbeat stats
  const grouped = groupByPage(heartbeats);
  const pageNames = Object.keys(grouped).sort((a, b) => {
    const catA = getPageCategory(a);
    const catB = getPageCategory(b);
    if (catA !== catB) {
      const order = { tv: 0, queue: 1, other: 2 };
      return order[catA] - order[catB];
    }
    return a.localeCompare(b, undefined, { numeric: true });
  });
  const tvPages = pageNames.filter((p) => getPageCategory(p) === 'tv');
  const queuePages = pageNames.filter((p) => getPageCategory(p) === 'queue');
  const otherPages = pageNames.filter((p) => getPageCategory(p) === 'other');

  // Managed screen stats
  const managedOnline = managedScreens.filter((s) => getStatus(s.last_seen) === 'online').length;
  const managedAssigned = managedScreens.filter((s) => s.assigned_path).length;

  return (
    <div className="min-h-screen bg-black text-white">
      <AdminNav userEmail={userEmail} displayName={displayName} onLogout={handleLogout} />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Screen Controller</h2>
          <p style={{ fontSize: 14, color: '#888', marginTop: 4, marginBottom: 0 }}>
            Manage and assign display screens. Point each Pi to <code style={{ background: '#2a2a2a', padding: '1px 5px', borderRadius: 3, fontSize: 13 }}>/screen</code> to register.
          </p>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={statCardStyle}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>{managedScreens.length}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Registered</div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#22C55E' }}>{managedOnline}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Online</div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#8B5CF6' }}>{managedAssigned}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Assigned</div>
          </div>
          <div style={statCardStyle}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#F59E0B' }}>{managedScreens.length - managedAssigned}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Awaiting</div>
          </div>
        </div>

        {/* ── Managed Screens ── */}
        {managedScreens.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '60px 20px', marginBottom: 32 }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📺</div>
            <p style={{ color: '#888', fontSize: 15, marginBottom: 4 }}>No screens registered yet</p>
            <p style={{ color: '#555', fontSize: 13 }}>
              Open <code style={{ background: '#2a2a2a', padding: '1px 5px', borderRadius: 3 }}>/screen</code> on a device to register it.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12, marginBottom: 32 }}>
            {managedScreens.map((screen) => (
              <ManagedScreenCard
                key={screen.id}
                screen={screen}
                onAssign={handleAssignPath}
                onRename={handleRenameSreen}
                onReload={handleReload}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}

        {/* ── Legacy Heartbeats (collapsible) ── */}
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => setShowLegacy(!showLegacy)}
            style={{
              ...sectionHeaderStyle,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '8px 0',
            }}
          >
            <span style={{ transition: 'transform 0.2s', transform: showLegacy ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>
              &#9654;
            </span>
            Legacy Heartbeats ({heartbeats.length} devices)
          </button>

          {showLegacy && (
            <div style={{ marginTop: 12 }}>
              {heartbeats.length === 0 ? (
                <p style={{ color: '#555', fontSize: 13, padding: '12px 0' }}>No legacy heartbeats detected.</p>
              ) : (
                <>
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
            </div>
          )}
        </div>

        {/* SQL setup note */}
        <div style={{ marginTop: 32, padding: '16px 20px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, fontSize: 12, color: '#666' }}>
          <strong style={{ color: '#888' }}>Supabase Tables Required</strong>
          <p style={{ margin: '6px 0 0' }}>
            This page reads from the <code style={{ background: '#2a2a2a', padding: '1px 5px', borderRadius: 3 }}>screens</code> table (screen controller) and the legacy{' '}
            <code style={{ background: '#2a2a2a', padding: '1px 5px', borderRadius: 3 }}>screen_heartbeats</code> table.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Managed Screen Card ── */

function ManagedScreenCard({
  screen,
  onAssign,
  onRename,
  onReload,
  onRemove,
}: {
  screen: Screen;
  onAssign: (screen: Screen, path: string) => void;
  onRename: (screen: Screen, name: string) => void;
  onReload: (screen: Screen) => void;
  onRemove: (screen: Screen) => void;
}) {
  const status = getStatus(screen.last_seen);
  const statusInfo = statusColors[status];
  const [localName, setLocalName] = useState(screen.name || '');
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Keep local name in sync when screen data updates
  useEffect(() => {
    setLocalName(screen.name || '');
  }, [screen.name]);

  return (
    <div style={cardStyle}>
      {/* Header: code + status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Status dot with pulse */}
          <div style={{ position: 'relative', width: 10, height: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: statusInfo.bg }} />
            {status === 'online' && (
              <div style={{
                position: 'absolute', inset: -3, borderRadius: '50%',
                background: statusInfo.bg, opacity: 0.3,
                animation: 'pulse-ring 2s ease-out infinite',
              }} />
            )}
          </div>
          <div style={{
            fontSize: 22, fontWeight: 800, letterSpacing: '0.2em',
            fontFamily: 'monospace', color: '#fff',
          }}>
            {screen.code}
          </div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
          background: `${statusInfo.bg}15`, color: statusInfo.text,
          border: `1px solid ${statusInfo.bg}30`,
        }}>
          {statusInfo.label}
        </span>
      </div>

      {/* Name input */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 4 }}>Name</label>
        <input
          type="text"
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={() => onRename(screen, localName)}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          placeholder="e.g. Main Foyer Left"
          style={inputStyle}
        />
      </div>

      {/* Path assignment */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 4 }}>Assigned Display</label>
        <select
          value={screen.assigned_path || ''}
          onChange={(e) => onAssign(screen, e.target.value)}
          style={selectStyle}
        >
          {ASSIGNABLE_PATHS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Last seen */}
      <div style={{ fontSize: 11, color: '#666', marginBottom: 12 }}>
        Last seen: {timeAgo(screen.last_seen)}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => onReload(screen)}
          style={{ ...btnStyle, flex: 1 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#222'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#161616'; }}
        >
          Reload
        </button>
        {confirmRemove ? (
          <div style={{ display: 'flex', gap: 4, flex: 1 }}>
            <button
              onClick={() => { onRemove(screen); setConfirmRemove(false); }}
              style={{ ...btnStyle, flex: 1, background: '#7f1d1d', border: '1px solid #991b1b', color: '#fca5a5' }}
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmRemove(false)}
              style={{ ...btnStyle, flex: 1 }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmRemove(true)}
            style={{ ...btnStyle, flex: 1, color: '#EF4444' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#1a1010'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#161616'; }}
          >
            Remove
          </button>
        )}
      </div>

      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.3; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/* ── Legacy Page Card Component ── */

function PageCard({
  page,
  devices,
  now,
}: {
  page: string;
  devices: ScreenHeartbeat[];
  now: number;
}) {
  const sorted = [...devices].sort((a, b) => {
    const statusA = getStatus(a.last_seen);
    const statusB = getStatus(b.last_seen);
    const order = { online: 0, warning: 1, offline: 2 };
    if (order[statusA] !== order[statusB]) return order[statusA] - order[statusB];
    return new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime();
  });

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', width: 10, height: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: statusInfo.bg }} />
            {overallStatus === 'online' && (
              <div style={{
                position: 'absolute', inset: -3, borderRadius: '50%',
                background: statusInfo.bg, opacity: 0.3,
                animation: 'pulse-ring 2s ease-out infinite',
              }} />
            )}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
              {isQueue ? `🎢 ${label}` : `📺 ${label}`}
            </div>
            <div style={{ fontSize: 11, color: '#666' }}>/{page.replace('queue-', 'queue/')}</div>
          </div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
          background: `${statusInfo.bg}15`, color: statusInfo.text,
          border: `1px solid ${statusInfo.bg}30`,
        }}>
          {statusInfo.label}
        </span>
      </div>

      {sorted.map((device) => {
        const devStatus = getStatus(device.last_seen);
        const devInfo = statusColors[devStatus];

        return (
          <div
            key={device.screen_id}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', background: '#161616', borderRadius: 8,
              marginBottom: 4, fontSize: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: devInfo.bg, flexShrink: 0 }} />
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
    </div>
  );
}
