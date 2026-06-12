'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkAuth, clearAuthCache } from '@/lib/auth';
import AdminNav from '@/components/AdminNav';
import type { Screen, ParkSetting } from '@/types/database';
import { surface, border, text, radius, FONT_NUM, microLabel } from '@/lib/theme';
import MetricStat from '@/components/ui/MetricStat';
import { useToasts, ToastStack } from '@/components/ui/Toast';

/* ── Assignable paths ── */

// Fixed system display pages. Per-attraction queue pages are generated
// dynamically from the live attractions list (see buildAssignablePaths).
const SYSTEM_PATHS = [
  { value: '', label: 'Unassigned' },
  { value: '/tv1', label: 'TV1 — Mazes & Shows' },
  { value: '/tv2', label: 'TV2 — Ride Banners' },
  { value: '/tv2.5', label: 'TV2.5 — Compact Banners' },
  { value: '/tv3', label: 'TV3 — Show Times' },
  { value: '/tv3.5', label: 'TV3.5 — Fear Rating' },
  { value: '/tv4', label: 'TV4 — Carousel' },
  { value: '/tv4.5', label: 'TV4.5 — Lite Carousel (Pi)' },
  { value: '/tv5', label: 'TV5 — Glitch Montage' },
  { value: '/tv-ops', label: 'Operations View' },
];

/** Build the full assignable-path list, adding a queue page per attraction. */
function buildAssignablePaths(attractions: { name: string; slug: string }[]) {
  const queue = attractions.map((a) => ({
    value: `/queue?a=${a.slug}`,
    label: `Queue — ${a.name}`,
  }));
  return [...SYSTEM_PATHS, ...queue];
}

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

function getPathLabel(path: string | null, paths: { value: string; label: string }[]): string | null {
  if (!path) return null;
  const found = paths.find((p) => p.value === path);
  if (found) return found.label;
  // Legacy /queue/<slug> or unknown queue path → derive a friendly label
  const slugMatch = path.match(/\/queue(?:\?a=|\/)([a-z0-9-]+)/i);
  if (slugMatch) {
    const name = slugMatch[1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return `Queue — ${name}`;
  }
  return path;
}

/* ── Styles ── */

const cardStyle: React.CSSProperties = {
  background: surface.card,
  border: `1px solid ${border.default}`,
  borderRadius: radius.xl,
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
  background: surface.control,
  border: `1px solid ${border.strong}`,
  borderRadius: radius.md,
  color: text.secondary,
  fontSize: 13,
  padding: '9px 10px',
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
  const [attractions, setAttractions] = useState<{ name: string; slug: string }[]>([]);
  const [parkClosed, setParkClosed] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [brandText, setBrandText] = useState('');
  const [socialHandle, setSocialHandle] = useState('');
  const { toasts, pushToast } = useToasts();

  const assignablePaths = buildAssignablePaths(attractions);

  const fetchData = useCallback(async () => {
    const [screensRes, attractionsRes] = await Promise.all([
      supabase.from('screens').select('*').order('last_seen', { ascending: false }),
      supabase.from('attractions').select('name,slug').order('sort_order', { ascending: true }),
    ]);
    if (!screensRes.error && screensRes.data) setManagedScreens(screensRes.data);
    if (!attractionsRes.error && attractionsRes.data) setAttractions(attractionsRes.data);
  }, []);

  useEffect(() => {
    async function init() {
      const auth = await checkAuth();
      if (!auth.authenticated || auth.role !== 'admin') {
        window.location.href = '/login';
        return;
      }
      setUserEmail(auth.email || '');
      setDisplayName(auth.displayName || '');

      await fetchData();

      // Fetch park_closed + branding settings
      const { data: settings } = await supabase
        .from('park_settings')
        .select('key,value')
        .in('key', ['park_closed', 'tv_brand_text', 'tv_social_handle']);
      for (const row of settings || []) {
        if (row.key === 'park_closed') setParkClosed(row.value === 'true');
        if (row.key === 'tv_brand_text') setBrandText(row.value || '');
        if (row.key === 'tv_social_handle') setSocialHandle(row.value || '');
      }

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
    // Set the path — screen picks this up via polling (30s) or realtime (instant)
    const { error } = await supabase.from('screens').update({
      assigned_path: newPath,
    }).eq('id', screen.id);
    if (error) {
      pushToast('error', 'Failed to assign screen path');
      return;
    }
    // Audit trail (same column pattern as src/lib/audit.ts)
    const pathLabel = getPathLabel(newPath, assignablePaths) || newPath;
    const { error: auditError } = await supabase.from('audit_logs').insert({
      action_type: 'screen_assigned',
      attraction_id: null,
      attraction_name: screen.label || screen.code,
      performed_by: userEmail || 'admin',
      old_value: screen.assigned_path || null,
      new_value: newPath,
      details: `Screen "${screen.label || screen.code}" (${screen.code}) assigned to ${pathLabel}`,
    });
    if (auditError && process.env.NODE_ENV === 'development') {
      console.error('Audit log error:', auditError);
    }
  }

  async function handleToggleBlackout() {
    setToggling(true);
    const newValue = !parkClosed;
    const { error } = await supabase
      .from('park_settings')
      .upsert({ key: 'park_closed', value: String(newValue) }, { onConflict: 'key' });
    if (error) {
      pushToast('error', 'Failed to toggle screen blackout');
    } else {
      setParkClosed(newValue);
    }
    setToggling(false);
  }

  async function handleSaveBranding(key: 'tv_brand_text' | 'tv_social_handle', value: string) {
    const { error } = await supabase
      .from('park_settings')
      .upsert({ key, value: value.trim(), updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) {
      pushToast('error', 'Failed to save screen branding');
    } else {
      pushToast('success', 'Screen branding saved');
    }
  }

  async function handleDeleteScreen(screen: Screen) {
    const { error } = await supabase.from('screens').delete().eq('id', screen.id);
    if (error) pushToast('error', 'Failed to remove screen');
    fetchData();
  }

  async function handleLabelChange(screen: Screen, label: string) {
    const { error } = await supabase.from('screens').update({ label: label || null }).eq('id', screen.id);
    if (error) pushToast('error', 'Failed to rename screen');
  }

  async function handleLogout() {
    clearAuthCache(); await supabase.auth.signOut();
    window.location.href = '/login';
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: surface.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-white/60 text-lg">Loading...</div>
      </div>
    );
  }

  // Screen stats
  const managedOnline = managedScreens.filter((s) => getStatus(s.last_seen) === 'online').length;
  const managedAssigned = managedScreens.filter((s) => s.assigned_path).length;

  return (
    <div style={{ minHeight: '100vh', background: surface.page, color: text.primary }}>
      <AdminNav userEmail={userEmail} displayName={displayName} onLogout={handleLogout} />
      <ToastStack toasts={toasts} />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Screen Controller</h2>
            <p style={{ fontSize: 14, color: text.secondary, marginTop: 4, marginBottom: 0 }}>
              Manage and assign display screens. Point each Pi to <code style={{ background: surface.raised, padding: '1px 5px', borderRadius: 3, fontSize: 13 }}>/screen</code> to register.
            </p>
          </div>
          <button
            onClick={() => fetchData()}
            style={{
              padding: '8px 14px',
              background: surface.control,
              border: `1px solid ${border.strong}`,
              borderRadius: radius.md,
              color: text.secondary,
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
          border: parkClosed ? '1px solid #EF444440' : `1px solid ${border.default}`,
          transition: 'border-color 0.3s ease',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: text.primary, marginBottom: 2 }}>
              Black Out Screens
            </div>
            <div style={{ fontSize: 12, color: parkClosed ? '#F87171' : text.muted }}>
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
              background: parkClosed ? '#EF4444' : surface.raised,
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
            <MetricStat label="Registered" value={managedScreens.length} size={28} align="center" />
          </div>
          <div style={statCardStyle}>
            <MetricStat label="Online" value={managedOnline} size={28} align="center" color="#4ADE80" />
          </div>
          <div style={statCardStyle}>
            <MetricStat label="Assigned" value={managedAssigned} size={28} align="center" color="#A78BFA" />
          </div>
          <div style={statCardStyle}>
            <MetricStat label="Awaiting" value={managedScreens.length - managedAssigned} size={28} align="center" color="#FBBF24" />
          </div>
        </div>

        {/* ── Managed Screens ── */}
        {managedScreens.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '60px 20px', marginBottom: 32 }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📺</div>
            <p style={{ color: text.secondary, fontSize: 15, marginBottom: 4 }}>No screens registered yet</p>
            <p style={{ color: text.secondary, fontSize: 13 }}>
              Open <code style={{ background: surface.raised, padding: '1px 5px', borderRadius: 3 }}>/screen</code> on a device to register it.
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
                onLabelChange={handleLabelChange}
                assignablePaths={assignablePaths}
              />
            ))}
          </div>
        )}

        {/* ── Screen branding ── */}
        <div style={{ ...cardStyle, marginBottom: 32 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: text.primary, marginBottom: 2 }}>
            Screen branding
          </div>
          <p style={{ fontSize: 12, color: text.muted, marginTop: 2, marginBottom: 14 }}>
            Shown in the footer of all TV screens. Screens pick up changes on their next load.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ ...microLabel, display: 'block', marginBottom: 4 }}>Brand line</label>
              <input
                value={brandText}
                onChange={(e) => setBrandText(e.target.value)}
                onBlur={(e) => handleSaveBranding('tv_brand_text', e.target.value)}
                placeholder="Immersive Core · Fright Nights"
                style={{ ...selectStyle, cursor: 'text' }}
              />
            </div>
            <div>
              <label style={{ ...microLabel, display: 'block', marginBottom: 4 }}>Social handle</label>
              <input
                value={socialHandle}
                onChange={(e) => setSocialHandle(e.target.value)}
                onBlur={(e) => handleSaveBranding('tv_social_handle', e.target.value)}
                placeholder="@immersivecore"
                style={{ ...selectStyle, cursor: 'text' }}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ── Managed Screen Card ── */

function ManagedScreenCard({
  screen,
  onAssign,
  onDelete,
  onLabelChange,
  assignablePaths,
}: {
  screen: Screen;
  onAssign: (screen: Screen, path: string) => void;
  onDelete: (screen: Screen) => void;
  onLabelChange: (screen: Screen, label: string) => void;
  assignablePaths: { value: string; label: string }[];
}) {
  const status = getStatus(screen.last_seen);
  const statusInfo = statusColors[status];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(screen.label || '');
  const inputRef = useRef<HTMLInputElement>(null);

  function startEditing() {
    setDraft(screen.label || '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function save() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== (screen.label || '')) {
      onLabelChange(screen, trimmed);
    }
  }

  return (
    <div style={cardStyle}>
      {/* Header: label/code + status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0, flex: 1 }}>
          {/* Status dot with pulse */}
          <div style={{ position: 'relative', width: 10, height: 10, flexShrink: 0, marginTop: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: statusInfo.bg }} />
            {status === 'online' && (
              <div style={{
                position: 'absolute', inset: -3, borderRadius: '50%',
                background: statusInfo.bg, opacity: 0.3,
                animation: 'pulse-ring 2s ease-out infinite',
              }} />
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            {editing ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={save}
                onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
                placeholder="Enter screen name..."
                style={{
                  fontSize: 16, fontWeight: 700, color: text.primary,
                  background: surface.control, border: '1px solid #8B5CF6',
                  borderRadius: radius.sm, padding: '2px 8px', width: '100%',
                  outline: 'none',
                }}
              />
            ) : (
              <div onClick={startEditing} style={{ cursor: 'pointer' }}>
                <div style={{
                  fontSize: screen.label ? 16 : 22,
                  fontWeight: screen.label ? 700 : 800,
                  letterSpacing: screen.label ? 'normal' : '0.2em',
                  fontFamily: screen.label ? 'inherit' : 'monospace',
                  color: text.primary,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {screen.label || screen.code}
                </div>
                {screen.label && (
                  <div style={{ fontSize: 11, color: text.secondary, fontFamily: 'monospace', letterSpacing: '0.1em', marginTop: 2 }}>
                    {screen.code}
                  </div>
                )}
                {!screen.label && (
                  <div style={{ fontSize: 11, color: text.faint, marginTop: 2 }}>
                    Click to name this screen
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginTop: 2 }}>
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

      {/* Current info */}
      {(screen.assigned_path || screen.current_page) && (
        <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {screen.assigned_path && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#A78BFA', fontWeight: 600 }}>Assigned:</span>
              <span style={{ fontSize: 11, color: text.secondary }}>{getPathLabel(screen.assigned_path, assignablePaths)}</span>
            </div>
          )}
          {screen.current_page && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: text.secondary, fontWeight: 600 }}>Showing:</span>
              <span style={{ fontSize: 11, color: text.muted }}>{getPathLabel(screen.current_page, assignablePaths)}</span>
            </div>
          )}
        </div>
      )}

      {/* Path assignment / reassignment */}
      <div style={{ marginBottom: 8 }}>
        <label style={{ ...microLabel, display: 'block', marginBottom: 4 }}>
          {screen.assigned_path ? 'Reassign Display' : 'Assign Display'}
        </label>
        <select
          value=""
          onChange={(e) => onAssign(screen, e.target.value)}
          style={selectStyle}
        >
          <option value="" disabled>Select a page...</option>
          {assignablePaths.filter((p) => p.value).map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Last seen */}
      <div style={{ fontSize: 11, color: text.secondary, ...FONT_NUM }}>
        Last seen: {timeAgo(screen.last_seen)}
        {screen.name && <span style={{ marginLeft: 8, color: text.secondary }}>({screen.name})</span>}
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

