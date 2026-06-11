'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { checkAuth } from '@/lib/auth';
import { surface, border, text, radius, card, microLabel, FONT_NUM, accents } from '@/lib/theme';
import MetricStat from '@/components/ui/MetricStat';
import type { Attraction, Screen, UserRole, AuditLog, OperatorSession } from '@/types/database';

/**
 * /backoffice — platform owner's mission control.
 *
 * Hard-locked to the owner account. Note: this is a client-side gate on a
 * static site — actual data protection comes from Supabase RLS (the gate is
 * about access, the database is the security boundary).
 */
const OWNER_EMAIL = 'finley@immersivecore.network';

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // screen heartbeats every 30s

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export default function BackofficePage() {
  const [state, setState] = useState<'checking' | 'denied' | 'ok'>('checking');
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [users, setUsers] = useState<UserRole[]>([]);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [sessions, setSessions] = useState<OperatorSession[]>([]);
  const [keepAlive, setKeepAlive] = useState<string | null>(null);
  const [guestsToday, setGuestsToday] = useState(0);
  const [dispatchesToday, setDispatchesToday] = useState(0);
  const [auditToday, setAuditToday] = useState(0);

  useEffect(() => {
    async function init() {
      const auth = await checkAuth();
      if (!auth.authenticated) {
        window.location.href = `/login?next=/backoffice`;
        return;
      }
      if (auth.email !== OWNER_EMAIL) {
        setState('denied');
        return;
      }

      const today = todayStr();
      const [att, scr, usr, aud, ops, ka, disp, audCount] = await Promise.all([
        supabase.from('attractions').select('*').order('sort_order'),
        supabase.from('screens').select('*').order('created_at'),
        supabase.from('user_roles').select('*').order('created_at'),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(12),
        supabase.from('operator_sessions').select('*').eq('log_date', today).order('started_at', { ascending: false }),
        supabase.from('keep_alive').select('last_ping').eq('id', 1).single(),
        supabase.from('dispatch_logs').select('group_size').eq('log_date', today),
        supabase.from('audit_logs').select('id', { count: 'exact', head: true }).gte('created_at', `${today}T00:00:00Z`),
      ]);

      setAttractions(att.data || []);
      setScreens(scr.data || []);
      setUsers(usr.data || []);
      setAudit(aud.data || []);
      setSessions(ops.data || []);
      setKeepAlive(ka.data?.last_ping ?? null);
      const dispatches = disp.data || [];
      setDispatchesToday(dispatches.length);
      setGuestsToday(dispatches.reduce((s, d) => s + (d.group_size || 0), 0));
      setAuditToday(audCount.count ?? 0);
      setState('ok');
    }
    init();
  }, []);

  if (state === 'checking') {
    return (
      <div style={{ minHeight: '100vh', background: surface.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: text.faint, fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  if (state === 'denied') {
    return (
      <div style={{ minHeight: '100vh', background: surface.page, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ ...card(), padding: 32, maxWidth: 360, textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, margin: '0 auto 14px',
            background: 'rgba(239,68,68,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <p style={{ color: text.primary, fontSize: 16, fontWeight: 600, margin: 0 }}>Restricted</p>
          <p style={{ color: text.muted, fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
            The backoffice is only available to the platform owner.
          </p>
          <a href="/landing" style={{ display: 'inline-block', marginTop: 18, color: text.secondary, fontSize: 13, textDecoration: 'none', borderBottom: `1px solid ${border.divider}`, paddingBottom: 2 }}>
            Back to CoreLink
          </a>
        </div>
      </div>
    );
  }

  const now = Date.now();
  const onlineScreens = screens.filter((s) => s.last_seen && now - new Date(s.last_seen).getTime() < ONLINE_THRESHOLD_MS);
  const openAttractions = attractions.filter((a) => a.status === 'OPEN');
  const activeSessions = sessions.filter((s) => !s.ended_at);
  const keepAliveAgeHours = keepAlive ? (now - new Date(keepAlive).getTime()) / 3600000 : Infinity;
  const keepAliveHealthy = keepAliveAgeHours < 48;

  return (
    <div style={{ minHeight: '100vh', background: surface.page }}>
      {/* Header */}
      <div style={{ background: surface.card, borderBottom: `1px solid ${border.default}`, padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" style={{ width: 26, height: 26, objectFit: 'contain' }} />
          <h1 style={{ color: text.primary, fontSize: 15, fontWeight: 700, margin: 0 }}>Backoffice</h1>
          <span style={{
            padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
            background: 'rgba(239,68,68,0.10)', color: '#FCA5A5', textTransform: 'uppercase',
          }}>
            Owner
          </span>
        </div>
        <a href="/landing" style={{ color: text.muted, fontSize: 13, textDecoration: 'none' }}>Exit</a>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 20px' }}>
        {/* System health */}
        <p style={{ ...microLabel, marginBottom: 10 }}>System health</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 28 }}>
          <div style={{ ...card(), padding: 16 }}>
            <MetricStat label="Screens online" value={`${onlineScreens.length}/${screens.length}`} color={onlineScreens.length === screens.length ? '#4ADE80' : '#FBBF24'} />
          </div>
          <div style={{ ...card(), padding: 16 }}>
            <MetricStat label="Attractions open" value={`${openAttractions.length}/${attractions.length}`} />
          </div>
          <div style={{ ...card(), padding: 16 }}>
            <MetricStat label="Keep-alive ping" value={timeAgo(keepAlive)} color={keepAliveHealthy ? '#4ADE80' : '#F87171'} size={16} />
          </div>
          <div style={{ ...card(), padding: 16 }}>
            <MetricStat label="Staff accounts" value={users.length} />
          </div>
        </div>

        {/* Tonight */}
        <p style={{ ...microLabel, marginBottom: 10 }}>Tonight</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 28 }}>
          <div style={{ ...card(), padding: 16 }}>
            <MetricStat label="Guests through" value={guestsToday.toLocaleString()} />
          </div>
          <div style={{ ...card(), padding: 16 }}>
            <MetricStat label="Dispatches" value={dispatchesToday.toLocaleString()} />
          </div>
          <div style={{ ...card(), padding: 16 }}>
            <MetricStat label="Operators on shift" value={activeSessions.length} color={activeSessions.length > 0 ? '#4ADE80' : text.muted} />
          </div>
          <div style={{ ...card(), padding: 16 }}>
            <MetricStat label="Audit events today" value={auditToday.toLocaleString()} />
          </div>
        </div>

        {/* Screens */}
        <p style={{ ...microLabel, marginBottom: 10 }}>Screens</p>
        <div style={{ ...card(), marginBottom: 28, overflow: 'hidden' }}>
          {screens.length === 0 && (
            <div style={{ padding: 16, color: text.faint, fontSize: 13 }}>No screens registered</div>
          )}
          {screens.map((s, i) => {
            const online = s.last_seen ? now - new Date(s.last_seen).getTime() < ONLINE_THRESHOLD_MS : false;
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: i > 0 ? `1px solid ${border.divider}` : 'none' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: online ? '#22C55E' : '#475569', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: text.primary, fontSize: 13, fontWeight: 500 }}>
                    {s.label || s.name || s.code}
                    <span style={{ color: text.faint, fontWeight: 400, marginLeft: 8, fontSize: 12 }}>{s.code}</span>
                  </div>
                  <div style={{ color: text.muted, fontSize: 11, marginTop: 1 }}>
                    {s.assigned_path || 'unassigned'}
                  </div>
                </div>
                <span style={{ color: online ? '#4ADE80' : text.faint, fontSize: 11, ...FONT_NUM }}>
                  {online ? 'online' : `seen ${timeAgo(s.last_seen)}`}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {/* Users */}
          <div>
            <p style={{ ...microLabel, marginBottom: 10 }}>Staff</p>
            <div style={{ ...card(), overflow: 'hidden' }}>
              {users.map((u, i) => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderTop: i > 0 ? `1px solid ${border.divider}` : 'none' }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                    background: u.role === 'admin' ? accents.admin.strong : '#374151',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 10, fontWeight: 600,
                  }}>
                    {(u.display_name || u.email)[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: text.primary, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.display_name || u.email}
                    </div>
                  </div>
                  <span style={{ color: u.role === 'admin' ? '#FCA5A5' : text.muted, fontSize: 11, fontWeight: 600 }}>{u.role}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent activity */}
          <div>
            <p style={{ ...microLabel, marginBottom: 10 }}>Recent activity</p>
            <div style={{ ...card(), overflow: 'hidden' }}>
              {audit.length === 0 && (
                <div style={{ padding: 16, color: text.faint, fontSize: 13 }}>No audit events</div>
              )}
              {audit.map((a, i) => (
                <div key={a.id} style={{ padding: '10px 16px', borderTop: i > 0 ? `1px solid ${border.divider}` : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ color: text.secondary, fontSize: 12, fontWeight: 500 }}>{a.action_type}</span>
                    <span style={{ color: text.faint, fontSize: 11, flexShrink: 0, ...FONT_NUM }}>{timeAgo(a.created_at)}</span>
                  </div>
                  <div style={{ color: text.muted, fontSize: 11, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.attraction_name && <span>{a.attraction_name} · </span>}
                    {a.performed_by}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
