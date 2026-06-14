'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkAuth, clearAuthCache } from '@/lib/auth';
import AdminNav from '@/components/AdminNav';
import type { Alert, AlertLevel } from '@/types/database';
import { surface, border, text as textTok, accents, radius, microLabel, FONT_NUM, primaryButton, controlButton } from '@/lib/theme';
import { useToasts, ToastStack } from '@/components/ui/Toast';

type AttractionLite = { id: string; name: string; slug: string };

const LEVELS: { key: AlertLevel; label: string; color: string }[] = [
  { key: 'info', label: 'Info', color: '#3B82F6' },
  { key: 'warning', label: 'Warning', color: '#F59E0B' },
  { key: 'urgent', label: 'Urgent', color: '#EF4444' },
];

function levelColor(level: AlertLevel): string {
  return LEVELS.find((l) => l.key === level)?.color ?? '#64748B';
}

function levelLabel(level: AlertLevel): string {
  return LEVELS.find((l) => l.key === level)?.label ?? level;
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function AlertsPage() {
  const router = useRouter();
  const { toasts, pushToast } = useToasts();

  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);

  const [attractions, setAttractions] = useState<AttractionLite[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // Composer state
  const [message, setMessage] = useState('');
  const [level, setLevel] = useState<AlertLevel>('info');
  const [target, setTarget] = useState<'all' | 'specific'>('all');
  const [chosenId, setChosenId] = useState('');
  const [sending, setSending] = useState(false);

  const fetchAlerts = useCallback(async () => {
    const { data } = await supabase
      .from('alerts')
      .select('id,message,level,target_all,attraction_id,active,created_by,created_at')
      .eq('active', true)
      .order('created_at', { ascending: false });
    if (data) setAlerts(data as Alert[]);
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

      const { data: attractionsData } = await supabase
        .from('attractions')
        .select('id,name,slug')
        .order('sort_order', { ascending: true });
      if (attractionsData) {
        setAttractions(attractionsData as AttractionLite[]);
        if (attractionsData.length > 0) setChosenId(attractionsData[0].id);
      }

      await fetchAlerts();
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Realtime subscription → refetch
  useEffect(() => {
    const channel = supabase
      .channel('alerts-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
        fetchAlerts();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAlerts]);

  function attractionName(id: string | null): string {
    if (!id) return 'All attractions';
    return attractions.find((a) => a.id === id)?.name ?? 'Unknown attraction';
  }

  async function handleSend() {
    if (!message.trim() || sending) return;
    setSending(true);
    const { error } = await supabase.from('alerts').insert({
      message: message.trim(),
      level,
      target_all: target === 'all',
      attraction_id: target === 'specific' ? chosenId || null : null,
      active: true,
      created_by: displayName || userEmail,
    });
    setSending(false);
    if (error) {
      pushToast('error', 'Failed to send alert');
      return;
    }
    pushToast('success', 'Alert sent to Control');
    setMessage('');
    fetchAlerts();
  }

  async function handleClear(id: string) {
    const prev = alerts;
    setAlerts((a) => a.filter((x) => x.id !== id));
    const { error } = await supabase.from('alerts').update({ active: false }).eq('id', id);
    if (error) {
      setAlerts(prev);
      pushToast('error', 'Failed to clear alert');
      return;
    }
    pushToast('success', 'Alert cleared');
  }

  async function handleClearAll() {
    const prev = alerts;
    const ids = alerts.map((a) => a.id);
    setAlerts([]);
    const { error } = await supabase.from('alerts').update({ active: false }).in('id', ids);
    if (error) {
      setAlerts(prev);
      pushToast('error', 'Failed to clear alerts');
      return;
    }
    pushToast('success', 'All alerts cleared');
  }

  async function handleLogout() {
    clearAuthCache();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: surface.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-white text-xl font-semibold animate-pulse">Loading...</div>
      </div>
    );
  }

  const canSend = message.trim().length > 0 && !sending && (target === 'all' || !!chosenId);

  return (
    <div style={{ minHeight: '100vh', background: surface.page, color: textTok.primary }}>
      <AdminNav userEmail={userEmail} displayName={displayName} onLogout={handleLogout} />

      <div className="max-w-3xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold" style={{ margin: '0 0 6px' }}>Alerts</h2>
        <p style={{ color: textTok.secondary, fontSize: 14, margin: '0 0 24px' }}>
          Push operational messages to the Control app.
        </p>

        {/* ── Composer ── */}
        <div style={{ background: surface.card, border: `1px solid ${border.default}`, borderRadius: radius.xl, padding: 20, marginBottom: 32 }}>
          <div style={{ ...microLabel, marginBottom: 6 }}>Message</div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What do operators need to know?"
            rows={3}
            style={{
              width: '100%',
              background: surface.control,
              border: `1px solid ${border.strong}`,
              borderRadius: radius.md,
              color: textTok.primary,
              padding: '10px 12px',
              fontSize: 14,
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />

          {/* Level segmented control */}
          <div style={{ ...microLabel, margin: '16px 0 6px' }}>Level</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {LEVELS.map((l) => {
              const active = level === l.key;
              return (
                <button
                  key={l.key}
                  onClick={() => setLevel(l.key)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: radius.md,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: `1px solid ${active ? l.color : border.strong}`,
                    background: active ? `${l.color}22` : surface.control,
                    color: active ? l.color : textTok.secondary,
                    transition: 'all 0.15s',
                  }}
                >
                  {l.label}
                </button>
              );
            })}
          </div>

          {/* Target segmented control */}
          <div style={{ ...microLabel, margin: '16px 0 6px' }}>Target</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {([
              { key: 'all', label: 'All attractions' },
              { key: 'specific', label: 'Specific attraction' },
            ] as const).map((t) => {
              const active = target === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTarget(t.key)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: radius.md,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: `1px solid ${active ? accents.admin.base : border.strong}`,
                    background: active ? accents.admin.soft : surface.control,
                    color: active ? accents.admin.text : textTok.secondary,
                    transition: 'all 0.15s',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {target === 'specific' && (
            <select
              value={chosenId}
              onChange={(e) => setChosenId(e.target.value)}
              style={{
                marginTop: 10,
                width: '100%',
                background: surface.control,
                border: `1px solid ${border.strong}`,
                color: textTok.primary,
                borderRadius: radius.md,
                padding: '8px 12px',
                fontSize: 14,
                outline: 'none',
              }}
            >
              {attractions.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}

          <button
            onClick={handleSend}
            disabled={!canSend}
            style={{
              ...primaryButton('admin'),
              marginTop: 20,
              padding: '10px 20px',
              fontSize: 14,
              opacity: canSend ? 1 : 0.5,
              cursor: canSend ? 'pointer' : 'not-allowed',
            }}
          >
            {sending ? 'Sending…' : 'Send alert'}
          </button>
        </div>

        {/* ── Active alerts ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 className="text-lg font-bold" style={{ margin: 0 }}>Active alerts</h3>
          {alerts.length > 1 && (
            <button
              onClick={handleClearAll}
              style={{ ...controlButton, padding: '6px 12px', fontSize: 12, fontWeight: 600 }}
            >
              Clear all
            </button>
          )}
        </div>

        {alerts.length === 0 ? (
          <div style={{ background: surface.card, border: `1px solid ${border.default}`, borderRadius: radius.lg, padding: '32px 20px', textAlign: 'center', color: textTok.muted, fontSize: 14 }}>
            No active alerts
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {alerts.map((a) => {
              const color = levelColor(a.level);
              return (
                <div
                  key={a.id}
                  style={{
                    background: surface.card,
                    border: `1px solid ${border.default}`,
                    borderLeft: `3px solid ${color}`,
                    borderTopLeftRadius: 0,
                    borderBottomLeftRadius: 0,
                    borderRadius: radius.lg,
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          padding: '2px 8px',
                          borderRadius: radius.pill,
                          background: `${color}22`,
                          color,
                        }}
                      >
                        {levelLabel(a.level)}
                      </span>
                      <span style={{ fontSize: 12, color: textTok.secondary }}>
                        {a.target_all ? 'All attractions' : attractionName(a.attraction_id)}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, color: textTok.primary, lineHeight: 1.4, wordBreak: 'break-word' }}>
                      {a.message}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: textTok.muted, ...FONT_NUM }}>
                      {a.created_by || 'Unknown'} · {formatTimestamp(a.created_at)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleClear(a.id)}
                    style={{ ...controlButton, padding: '6px 12px', fontSize: 12, fontWeight: 600, flexShrink: 0 }}
                  >
                    Clear
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ToastStack toasts={toasts} />
    </div>
  );
}
