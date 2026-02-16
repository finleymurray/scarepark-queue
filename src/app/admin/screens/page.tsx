'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkAuth } from '@/lib/auth';
import AdminNav from '@/components/AdminNav';
import type { Screen, ParkSetting } from '@/types/database';

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

/* ── Page Component ── */

export default function ScreensPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [managedScreens, setManagedScreens] = useState<Screen[]>([]);
  const [parkClosed, setParkClosed] = useState(false);
  const [toggling, setToggling] = useState(false);

  const fetchData = useCallback(async () => {
    const { data, error } = await supabase
      .from('screens')
      .select('*')
      .order('last_seen', { ascending: false });

    if (!error && data) setManagedScreens(data);
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

      // Fetch park_closed setting
      const { data: closedSetting } = await supabase
        .from('park_settings')
        .select('key,value')
        .eq('key', 'park_closed')
        .single();
      if (closedSetting) setParkClosed(closedSetting.value === 'true');

      setLoading(false);
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Refresh every 15s + realtime subscription for screens
  useEffect(() => {
    if (loading) return;

    const dataInterval = setInterval(fetchData, 15000);

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

    // Realtime: park_settings updates (for blackout toggle sync)
    const settingsChannel = supabase
      .channel('admin-screens-settings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'park_settings' },
        (payload) => {
          const setting = payload.new as ParkSetting;
          if (setting.key === 'park_closed') {
            setParkClosed(setting.value === 'true');
          }
        },
      )
      .subscribe();

    return () => {
      clearInterval(dataInterval);
      supabase.removeChannel(channel);
      supabase.removeChannel(settingsChannel);
    };
  }, [loading, fetchData]);

  async function handleAssignPath(screen: Screen, newPath: string) {
    if (!newPath) return;
    // Set the path — the screen will pick this up, navigate, and delete its own row
    await supabase.from('screens').update({
      assigned_path: newPath,
    }).eq('id', screen.id);
  }

  async function handleToggleBlackout() {
    setToggling(true);
    const newValue = !parkClosed;
    await supabase
      .from('park_settings')
      .upsert({ key: 'park_closed', value: String(newValue) }, { onConflict: 'key' });
    setParkClosed(newValue);
    setToggling(false);
  }

  async function handleDeleteScreen(screen: Screen) {
    await supabase.from('screens').delete().eq('id', screen.id);
    fetchData();
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

  // Screen stats
  const managedOnline = managedScreens.filter((s) => getStatus(s.last_seen) === 'online').length;
  const managedAssigned = managedScreens.filter((s) => s.assigned_path).length;

  return (
    <div className="min-h-screen bg-black text-white">
      <AdminNav userEmail={userEmail} displayName={displayName} onLogout={handleLogout} />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Screen Controller</h2>
            <p style={{ fontSize: 14, color: '#888', marginTop: 4, marginBottom: 0 }}>
              Manage and assign display screens. Point each Pi to <code style={{ background: '#2a2a2a', padding: '1px 5px', borderRadius: 3, fontSize: 13 }}>/screen</code> to register.
            </p>
          </div>
          <button
            onClick={() => fetchData()}
            style={{
              padding: '6px 12px',
              background: '#161616',
              border: '1px solid #2a2a2a',
              borderRadius: 8,
              color: '#888',
              fontSize: 12,
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M14 8A6 6 0 1 1 8 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M8 0L10.5 2.5L8 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Black Out Screens toggle */}
        <div style={{
          ...cardStyle,
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          border: parkClosed ? '1px solid #EF444440' : '1px solid #2a2a2a',
          transition: 'border-color 0.3s ease',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
              Black Out Screens
            </div>
            <div style={{ fontSize: 12, color: parkClosed ? '#EF4444' : '#666' }}>
              {parkClosed ? 'All displays are blacked out' : 'All displays showing live content'}
            </div>
          </div>
          <button
            onClick={handleToggleBlackout}
            disabled={toggling}
            style={{
              position: 'relative',
              width: 52,
              height: 28,
              borderRadius: 14,
              border: 'none',
              cursor: toggling ? 'wait' : 'pointer',
              background: parkClosed ? '#EF4444' : '#333',
              transition: 'background 0.3s ease',
              flexShrink: 0,
            }}
          >
            <div style={{
              position: 'absolute',
              top: 3,
              left: parkClosed ? 27 : 3,
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.3s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
            }} />
          </button>
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
                onDelete={handleDeleteScreen}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

/* ── Managed Screen Card ── */

function ManagedScreenCard({
  screen,
  onAssign,
  onDelete,
}: {
  screen: Screen;
  onAssign: (screen: Screen, path: string) => void;
  onDelete: (screen: Screen) => void;
}) {
  const status = getStatus(screen.last_seen);
  const statusInfo = statusColors[status];

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
            background: `${statusInfo.bg}15`, color: statusInfo.text,
            border: `1px solid ${statusInfo.bg}30`,
          }}>
            {statusInfo.label}
          </span>
          {status === 'offline' && (
            <button
              onClick={() => onDelete(screen)}
              title="Remove offline screen"
              style={{
                padding: '3px 6px',
                background: 'transparent',
                border: '1px solid #EF444430',
                borderRadius: 6,
                color: '#EF4444',
                fontSize: 11,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Path assignment */}
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 4 }}>Assign Display</label>
        <select
          value=""
          onChange={(e) => onAssign(screen, e.target.value)}
          style={selectStyle}
        >
          <option value="" disabled>Select a page...</option>
          {ASSIGNABLE_PATHS.filter((p) => p.value).map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Last seen */}
      <div style={{ fontSize: 11, color: '#666' }}>
        Last seen: {timeAgo(screen.last_seen)}
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

