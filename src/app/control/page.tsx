'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { checkAuth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { getAttractionLogo, getLogoGlow } from '@/lib/logos';
import { getSignoffStatus } from '@/lib/signoff';
import type { AttractionSignoffStatus } from '@/lib/signoff';
import type { Attraction, ThroughputLog, DispatchLog } from '@/types/database';
import { saveShowReportDraft, getExistingReport } from '@/lib/showReport';
import AppSwitcher from '@/components/AppSwitcher';

/* ── Helpers ── */

function getTodayDateStr(): string {
  return new Date().toISOString().split('T')[0];
}

function formatSlotTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function generateHourlySlots(openTime: string, closeTime: string): { start: string; end: string }[] {
  if (!openTime || !closeTime) return [];
  const [oh, om] = openTime.split(':').map(Number);
  const [ch] = closeTime.split(':').map(Number);
  let startMinutes = oh * 60 + (om || 0);
  let endMinutes = ch * 60;
  if (endMinutes <= startMinutes) endMinutes += 24 * 60;
  endMinutes += 60; // 1hr buffer after close
  const slots: { start: string; end: string }[] = [];
  let cursor = startMinutes;
  while (cursor < endMinutes) {
    const next = Math.min(cursor + 60, endMinutes);
    const sh = Math.floor(cursor / 60) % 24, sm = cursor % 60;
    const eh = Math.floor(next / 60) % 24, em = next % 60;
    slots.push({
      start: `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`,
      end: `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`,
    });
    cursor = next;
  }
  return slots;
}

function getCurrentSlotIndex(slots: { start: string; end: string }[]): number {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  for (let i = 0; i < slots.length; i++) {
    const [sh, sm] = slots[i].start.split(':').map(Number);
    const [eh, em] = slots[i].end.split(':').map(Number);
    let startMin = sh * 60 + sm, endMin = eh * 60 + em;
    if (endMin <= startMin) endMin += 24 * 60;
    let checkNow = nowMinutes;
    if (checkNow < startMin && startMin > 12 * 60) checkNow += 24 * 60;
    if (checkNow >= startMin && checkNow < endMin) return i;
  }
  return -1;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ── Main Supervisor Dashboard ── */
export default function SupervisorDashboard() {
  const router = useRouter();
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [throughputLogs, setThroughputLogs] = useState<ThroughputLog[]>([]);
  const [openingTime, setOpeningTime] = useState('');
  const [closingTime, setClosingTime] = useState('');
  const [now, setNow] = useState(Date.now());
  // Edit throughput modal
  const [editSlot, setEditSlot] = useState<{ start: string; end: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Dispatch clicker state
  const [dispatchGroupSize, setDispatchGroupSize] = useState(0);
  const [dispatchLogs, setDispatchLogs] = useState<DispatchLog[]>([]);
  const [lastDispatchAt, setLastDispatchAt] = useState<string | null>(null);
  const [dispatchElapsed, setDispatchElapsed] = useState(0);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchFlashOn, setDispatchFlashOn] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [signoffStatus, setSignoffStatus] = useState<AttractionSignoffStatus | null>(null);
  const [delayStartedAt, setDelayStartedAt] = useState<string | null>(null);
  const [delayElapsed, setDelayElapsed] = useState(0);

  // Notes drawer
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesData, setNotesData] = useState({
    operational_report: '',
    technical_report: '',
    costume_report: '',
    construction_report: '',
    additional_notes: '',
  });
  const [notesSaving, setNotesSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const notesSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [notesLastSaved, setNotesLastSaved] = useState<string | null>(null);

  // Push notifications — per-device opt-in stored in localStorage
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const notifEnabledRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('ic-notif-enabled') === 'true';
    const perm = 'Notification' in window ? Notification.permission : 'denied';
    setNotifEnabled(saved && perm === 'granted');
    setNotifPermission(perm as NotificationPermission);
    notifEnabledRef.current = saved && perm === 'granted';
  }, []);

  async function handleNotifToggle() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'denied') {
      alert('Notifications are blocked in your browser settings. Enable them for this site and try again.');
      return;
    }
    if (!notifEnabled) {
      const perm = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
      setNotifPermission(perm);
      if (perm === 'granted') {
        setNotifEnabled(true);
        notifEnabledRef.current = true;
        localStorage.setItem('ic-notif-enabled', 'true');
        new Notification('IC Control', { body: 'Status change notifications enabled.', icon: '/logo-control.png' });
      }
    } else {
      setNotifEnabled(false);
      notifEnabledRef.current = false;
      localStorage.setItem('ic-notif-enabled', 'false');
    }
  }

  const tabBarRef = useRef<HTMLDivElement>(null);

  // Auth & initial data fetch
  useEffect(() => {
    let attractionsChannel: ReturnType<typeof supabase.channel> | null = null;
    let logsChannel: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      const auth = await checkAuth();
      if (!auth.authenticated || !auth.role) {
        router.push('/control/login');
        return;
      }
      // Store email, display name and role for display
      setUserEmail(auth.email || '');
      setDisplayName(auth.displayName || '');
      setUserRole(auth.role);

      // Filter attractions at query level for supervisors (H2 fix)
      let attractionsQuery = supabase.from('attractions').select('id,name,slug,status,wait_time,sort_order,attraction_type,show_times,updated_at,target_dispatch_seconds').order('sort_order', { ascending: true });
      if (auth.role === 'supervisor' && auth.allowedAttractions && auth.allowedAttractions.length > 0) {
        attractionsQuery = attractionsQuery.in('id', auth.allowedAttractions);
      }

      const [attractionsRes, settingsRes] = await Promise.all([
        attractionsQuery,
        supabase.from('park_settings').select('key,value'),
      ]);
      if (settingsRes.data) {
        for (const s of settingsRes.data) {
          if (s.key === 'opening_time') setOpeningTime(s.value);
          if (s.key === 'closing_time') setClosingTime(s.value);
        }
      }

      if (!attractionsRes.error && attractionsRes.data) {
        setAttractions(attractionsRes.data);
        // Restore last-selected attraction, fall back to first ride
        const saved = localStorage.getItem('ic-control-selected');
        const savedExists = saved && attractionsRes.data.find((a: Attraction) => a.id === saved);
        const firstRide = attractionsRes.data.find((a: Attraction) => a.attraction_type !== 'show');
        setSelectedId(savedExists ? saved : (firstRide?.id ?? null));
      }

      setLoading(false);

      // Realtime: attractions
      attractionsChannel = supabase
        .channel('control-attractions')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'attractions' },
          (payload) => {
            if (payload.eventType === 'UPDATE') {
              const updated = payload.new as Attraction;
              setAttractions((prev) => {
                // Fire push notification on status change if enabled
                const old = prev.find((a) => a.id === updated.id);
                if (notifEnabledRef.current && old && old.status !== updated.status) {
                  const statusMessages: Partial<Record<string, string>> = {
                    DELAYED: 'Technical delay in progress',
                    CLOSED: 'Attraction is now closed',
                    'AT CAPACITY': 'At capacity — queue paused',
                    OPEN: 'Attraction is back open',
                  };
                  new Notification(`${updated.name} — ${updated.status}`, {
                    body: statusMessages[updated.status] || updated.status,
                    icon: '/logo-control.png',
                    tag: `status-${updated.id}`, // replaces previous notif for same attraction
                  });
                }
                return prev.map((a) => a.id === updated.id ? updated : a);
              });
            } else if (payload.eventType === 'INSERT') {
              setAttractions((prev) =>
                [...prev, payload.new as Attraction].sort((a, b) => a.sort_order - b.sort_order)
              );
            } else if (payload.eventType === 'DELETE') {
              setAttractions((prev) =>
                prev.filter((a) => a.id !== (payload.old as Attraction).id)
              );
            }
          }
        )
        .subscribe();

      // Realtime: throughput_logs — use payload to avoid refetching all logs
      logsChannel = supabase
        .channel('control-logs')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'throughput_logs' },
          (payload) => {
            const today = getTodayDateStr();
            if (payload.eventType === 'INSERT') {
              const newLog = payload.new as ThroughputLog;
              if (newLog.log_date === today) {
                setThroughputLogs((prev) => [...prev, newLog]);
              }
            } else if (payload.eventType === 'UPDATE') {
              const updated = payload.new as ThroughputLog;
              setThroughputLogs((prev) =>
                prev.map((l) => (l.id === updated.id ? updated : l))
              );
            } else if (payload.eventType === 'DELETE') {
              const deleted = payload.old as ThroughputLog;
              setThroughputLogs((prev) => prev.filter((l) => l.id !== deleted.id));
            }
          }
        )
        .subscribe();
    }

    init();

    return () => {
      if (attractionsChannel) supabase.removeChannel(attractionsChannel);
      if (logsChannel) supabase.removeChannel(logsChannel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Fetch signoff status for selected attraction
  useEffect(() => {
    if (!selectedId) { setSignoffStatus(null); return; }

    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function fetch() {
      const status = await getSignoffStatus(selectedId!);
      setSignoffStatus(status);
    }
    fetch();

    channel = supabase
      .channel(`control-signoff-${selectedId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'signoff_completions', filter: `attraction_id=eq.${selectedId}` },
        () => { fetch(); }
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [selectedId]);

  // Fetch dispatch logs when selectedId changes
  useEffect(() => {
    if (!selectedId) { setDispatchLogs([]); setLastDispatchAt(null); setDispatchElapsed(0); return; }

    let dispatchChannel: ReturnType<typeof supabase.channel> | null = null;

    async function fetchDispatchLogs(attractionId: string) {
      const today = getTodayDateStr();
      const { data } = await supabase.from('dispatch_logs')
        .select('*').eq('attraction_id', attractionId).eq('log_date', today)
        .order('dispatched_at', { ascending: false }).limit(10);
      setDispatchLogs(data || []);
      const latest = (data || [])[0];
      if (latest) setLastDispatchAt(latest.dispatched_at);
      else setLastDispatchAt(null);
    }

    fetchDispatchLogs(selectedId);
    setDispatchGroupSize(0);

    dispatchChannel = supabase
      .channel(`dispatch-logs-${selectedId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dispatch_logs', filter: `attraction_id=eq.${selectedId}` },
        () => { fetchDispatchLogs(selectedId); }
      )
      .subscribe();

    return () => {
      if (dispatchChannel) supabase.removeChannel(dispatchChannel);
    };
  }, [selectedId]);

  // Clock tick for current-slot highlighting
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Dispatch elapsed timer
  useEffect(() => {
    const interval = setInterval(() => {
      if (lastDispatchAt) {
        setDispatchElapsed(Math.floor((Date.now() - new Date(lastDispatchAt).getTime()) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lastDispatchAt]);

  // Flashing timer for when way over target
  useEffect(() => {
    const interval = setInterval(() => setDispatchFlashOn((v) => !v), 500);
    return () => clearInterval(interval);
  }, []);

  // Load existing notes when drawer opens or selectedId changes while open
  useEffect(() => {
    if (!notesOpen || !selectedId) return;
    let cancelled = false;
    async function loadNotes() {
      const today = new Date().toISOString().split('T')[0];
      const existing = await getExistingReport(selectedId!, today);
      if (!cancelled && existing) {
        setNotesData({
          operational_report: existing.operational_report || '',
          technical_report: existing.technical_report || '',
          costume_report: existing.costume_report || '',
          construction_report: existing.construction_report || '',
          additional_notes: existing.additional_notes || '',
        });
      } else if (!cancelled) {
        setNotesData({ operational_report: '', technical_report: '', costume_report: '', construction_report: '', additional_notes: '' });
      }
    }
    loadNotes();
    return () => { cancelled = true; };
  }, [notesOpen, selectedId]);

  // Auto-save notes with 2s debounce
  function handleNotesChange(field: keyof typeof notesData, value: string) {
    setNotesData((prev) => ({ ...prev, [field]: value }));
    setNotesSaving('saving');
    if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
    notesSaveTimer.current = setTimeout(async () => {
      if (!selectedId || !selected) return;
      const today = new Date().toISOString().split('T')[0];
      const updated = { ...notesData, [field]: value };
      const result = await saveShowReportDraft(selectedId, selected.name, today, updated);
      if (result.success) {
        setNotesSaving('saved');
        setNotesLastSaved(new Date().toISOString());
      } else {
        setNotesSaving('error');
      }
    }, 2000);
  }

  // Fetch throughput logs for today
  const fetchThroughputLogs = useCallback(async () => {
    const today = getTodayDateStr();

    const { data, error } = await supabase
      .from('throughput_logs')
      .select('id,attraction_id,slot_start,slot_end,guest_count,logged_by,log_date,created_at,updated_at')
      .eq('log_date', today);

    if (!error && data) {
      setThroughputLogs(data);
    }
  }, []);

  useEffect(() => {
    if (!loading) fetchThroughputLogs();
  }, [loading, fetchThroughputLogs]);

  // Only rides (not shows) for supervisor dashboard
  const rides = useMemo(() => attractions.filter((a) => a.attraction_type !== 'show'), [attractions]);

  // Auto-select first ride if current selection is invalid
  useEffect(() => {
    if (rides.length > 0 && (!selectedId || !rides.find((r) => r.id === selectedId))) {
      setSelectedId(rides[0].id);
    }
  }, [rides, selectedId]);

  // Selected attraction
  const selected = useMemo(() => rides.find((a) => a.id === selectedId) || null, [rides, selectedId]);

  // Fetch delay start time when selected attraction is DELAYED
  useEffect(() => {
    if (!selected || selected.status !== 'DELAYED') {
      setDelayStartedAt(null);
      setDelayElapsed(0);
      return;
    }

    let cancelled = false;
    async function fetchDelay() {
      const { data } = await supabase
        .from('attraction_status_logs')
        .select('changed_at')
        .eq('attraction_id', selected!.id)
        .eq('status', 'DELAYED')
        .is('resolved_at', null)
        .order('changed_at', { ascending: false })
        .limit(1)
        .single();

      if (!cancelled && data) {
        setDelayStartedAt(data.changed_at);
        setDelayElapsed(Math.floor((Date.now() - new Date(data.changed_at).getTime()) / 1000));
      }
    }
    fetchDelay();
    return () => { cancelled = true; };
  }, [selected?.id, selected?.status]);

  // Tick the delay elapsed counter every second when delayed
  useEffect(() => {
    if (!delayStartedAt) return;
    const interval = setInterval(() => {
      setDelayElapsed(Math.floor((Date.now() - new Date(delayStartedAt).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [delayStartedAt]);

  // Total guests tonight for selected attraction (from dispatch logs)
  const guestsTonight = useMemo(() => {
    return dispatchLogs.reduce((s, l) => s + l.group_size, 0);
  }, [dispatchLogs]);

  // Total guests across ALL attractions tonight (throughput-based for park total)
  const totalGuestsAllAttractions = useMemo(() => {
    let sum = 0;
    for (const l of throughputLogs) sum += l.guest_count;
    return sum;
  }, [throughputLogs]);

  // Hourly slots derived from park hours + dispatch counts per slot
  const hourlySlots = useMemo(() => generateHourlySlots(openingTime, closingTime), [openingTime, closingTime]);
  const currentSlotIndex = useMemo(() => getCurrentSlotIndex(hourlySlots), [hourlySlots, now]); // eslint-disable-line react-hooks/exhaustive-deps

  function getDispatchCountForSlot(slot: { start: string; end: string }): number {
    const today = getTodayDateStr();
    const [sh, sm] = slot.start.split(':').map(Number);
    const [eh, em] = slot.end.split(':').map(Number);
    let startMs = new Date(`${today}T${slot.start}:00`).getTime();
    let endMs   = new Date(`${today}T${slot.end}:00`).getTime();
    if (endMs <= startMs) endMs += 86400000;
    // Also check throughput_logs override for this slot
    const manual = throughputLogs.find(
      (l) => l.slot_start === slot.start && l.slot_end === slot.end && l.log_date === today
    );
    if (manual) return manual.guest_count;
    return dispatchLogs.filter((d) => {
      const t = new Date(d.dispatched_at).getTime();
      return t >= startMs && t < endMs;
    }).reduce((s, d) => s + d.group_size, 0);
  }

  async function saveSlotOverride(slot: { start: string; end: string }, count: number) {
    const today = getTodayDateStr();
    await supabase.from('throughput_logs').upsert({
      attraction_id: selectedId,
      slot_start: slot.start,
      slot_end: slot.end,
      guest_count: count,
      logged_by: displayName || userEmail,
      log_date: today,
    }, { onConflict: 'attraction_id,log_date,slot_start' });
    // Refresh throughput logs
    const { data } = await supabase.from('throughput_logs')
      .select('*').eq('attraction_id', selectedId ?? '').eq('log_date', today);
    setThroughputLogs(data || []);
  }

  // Handle queue time update
  async function handleWaitTimeUpdate(delta: number) {
    if (!selected) return;
    const oldTime = selected.wait_time || 0;
    const newTime = Math.max(0, Math.min(180, oldTime + delta));
    if (newTime === oldTime) return;
    await supabase
      .from('attractions')
      .update({ wait_time: newTime, updated_at: new Date().toISOString() })
      .eq('id', selected.id);

    logAudit({
      actionType: 'queue_time_change',
      attractionId: selected.id,
      attractionName: selected.name,
      performedBy: displayName || userEmail,
      oldValue: String(oldTime),
      newValue: String(newTime),
      details: `Wait time changed from ${oldTime}min to ${newTime}min`,
    });
  }

  async function handleDispatch() {
    if (dispatchGroupSize === 0 || dispatching || !selectedId) return;
    setDispatching(true);
    const today = getTodayDateStr();
    await supabase.from('dispatch_logs').insert({
      attraction_id: selectedId,
      group_size: dispatchGroupSize,
      dispatched_by: displayName || userEmail,
      log_date: today,
    });
    setDispatchGroupSize(0);
    const now = new Date().toISOString();
    setLastDispatchAt(now);
    setDispatchElapsed(0);
    const { data } = await supabase.from('dispatch_logs')
      .select('*').eq('attraction_id', selectedId).eq('log_date', today)
      .order('dispatched_at', { ascending: false }).limit(10);
    setDispatchLogs(data || []);
    setDispatching(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/control/login');
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="text-white text-2xl font-bold animate-pulse">Loading...</div>
      </div>
    );
  }

  if (rides.length === 0) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#000000', padding: '0 24px' }}>
        <div className="text-center">
          <p className="text-white/60 text-lg mb-4">No rides configured.</p>
          <p className="text-white/30 text-sm">Ask a manager to add rides in the Admin panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#000000', color: '#F1F5F9' }}>
      {/* Header */}
      <div style={{ background: '#111111', borderBottom: '1px solid #2a2a2a', height: 56, padding: '0 20px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AppSwitcher currentApp="control" isAdmin={userRole === 'admin'} />
          <a href="/control" style={{ textDecoration: 'none' }}>
            <h1 style={{ color: '#F1F5F9', fontSize: 15, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>Control</h1>
          </a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#94A3B8' }}>
          {(displayName || userEmail) && <span title={userEmail} style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName || userEmail}</span>}
          {'Notification' in (typeof window !== 'undefined' ? window : {}) && notifPermission !== 'denied' && (
            <button
              onClick={handleNotifToggle}
              title={notifEnabled ? 'Notifications on — click to disable' : 'Enable status notifications'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 4, color: notifEnabled ? '#22C55E' : '#555', transition: 'color 0.15s', lineHeight: 1 }}
            >
              {notifEnabled ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" opacity="0.4"/>
                  <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              )}
            </button>
          )}
          <button
            onClick={handleLogout}
            style={{
              background: 'none',
              border: '1px solid #2a2a2a',
              color: '#94A3B8',
              padding: '4px 10px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#444444';
              e.currentTarget.style.color = '#F1F5F9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#2a2a2a';
              e.currentTarget.style.color = '#aaa';
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Attraction Tab Bar — full width, horizontally scrollable */}
      <div
        ref={tabBarRef}
        className="scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ background: '#111111', borderBottom: '1px solid #2a2a2a', padding: '0 20px', flexShrink: 0, display: 'flex', gap: 0, overflowX: 'auto' }}
      >
        {rides.map((a) => {
          const isSelected = a.id === selectedId;
          return (
            <button
              key={a.id}
              onClick={() => { setSelectedId(a.id); localStorage.setItem('ic-control-selected', a.id); }}
              style={{
                flexShrink: 0,
                color: isSelected ? '#F1F5F9' : '#64748B',
                fontSize: 14,
                fontWeight: isSelected ? 600 : 500,
                padding: '14px 14px',
                borderRadius: 0,
                background: 'transparent',
                border: 'none',
                borderBottom: isSelected ? '2px solid #3B82F6' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'color 0.15s, border-color 0.15s',
                touchAction: 'manipulation',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.color = '#94A3B8';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.color = '#64748B';
                }
              }}
            >
              {(() => {
                const logo = getAttractionLogo(a.slug);
                const glow = getLogoGlow(a.slug);
                return logo ? (
                  <img src={logo} alt="" width={20} height={20} loading="lazy" decoding="async" className="inline-block rounded object-contain" style={{ width: 20, height: 20, marginRight: 6, verticalAlign: 'middle', filter: glow || undefined }} />
                ) : null;
              })()}
              {a.name}
            </button>
          );
        })}
      </div>

      {/* Main Content — Scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px' }}>
        {selected && (
          <>
            {/* ── Attraction Logo ── */}
            {(() => {
              const logo = getAttractionLogo(selected.slug);
              const glow = getLogoGlow(selected.slug);
              return logo ? (
                <div className="flex justify-center mb-6">
                  <img src={logo} alt={selected.name} loading="lazy" decoding="async" className="object-contain w-[100px] sm:w-[160px]" style={{ height: 'auto', maxHeight: 100, filter: glow || undefined }} />
                </div>
              ) : null;
            })()}

            {/* ── Sign-Off Status ── */}
            {signoffStatus && (
              <div className="mb-6 flex flex-col items-center gap-3">
                {signoffStatus.openingTotal > 0 && signoffStatus.openingCompleted === signoffStatus.openingTotal ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '5px 12px', borderRadius: 6, background: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Signed Off
                  </span>
                ) : signoffStatus.openingTotal > 0 && signoffStatus.openingCompleted > 0 ? (
                  <>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '5px 12px', borderRadius: 6, background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}>
                      {signoffStatus.openingCompleted}/{signoffStatus.openingTotal} Signed Off
                    </span>
                    <a
                      href="/signoff"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, background: '#111', border: '1px solid #2a2a2a', color: '#94A3B8', textDecoration: 'none', transition: 'border-color 0.15s, color 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3B82F6'; e.currentTarget.style.color = '#F1F5F9'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#94A3B8'; }}
                    >
                      Complete Sign-Offs
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2H10V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </a>
                  </>
                ) : (
                  <>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '5px 12px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                      Not Signed Off
                    </span>
                    <a
                      href="/signoff"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, background: '#111', border: '1px solid #2a2a2a', color: '#94A3B8', textDecoration: 'none', transition: 'border-color 0.15s, color 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3B82F6'; e.currentTarget.style.color = '#F1F5F9'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#94A3B8'; }}
                    >
                      Complete Sign-Offs
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2H10V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </a>
                  </>
                )}
              </div>
            )}

            {/* ── Dispatch Clicker ── */}
            {selected.attraction_type !== 'show' && (() => {
              const targetSeconds = selected.target_dispatch_seconds ?? 90;
              const timerColor = lastDispatchAt === null ? '#64748B'
                : dispatchElapsed > targetSeconds + 30 ? '#EF4444'
                : dispatchElapsed > targetSeconds ? '#EF4444'
                : dispatchElapsed > targetSeconds * 0.75 ? '#F59E0B'
                : '#22C55E';
              const timerFlashing = lastDispatchAt !== null && dispatchElapsed > targetSeconds + 30;
              const timerVisible = !timerFlashing || dispatchFlashOn;

              const dispatchMin = Math.floor(dispatchElapsed / 60);
              const dispatchSec = dispatchElapsed % 60;
              const timerStr = lastDispatchAt === null
                ? '—:—'
                : `${String(dispatchMin).padStart(2, '0')}:${String(dispatchSec).padStart(2, '0')}`;

              const totalDispatches = dispatchLogs.length;
              const totalGuests = dispatchLogs.reduce((s, l) => s + l.group_size, 0);

              return (
                <section style={{ marginBottom: 48 }}>
                  <div className="flex items-center gap-2.5 mb-5">
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6' }} />
                    <h2 style={{ color: '#94A3B8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, margin: 0 }}>Dispatch</h2>
                  </div>

                  <div style={{ background: '#111111', border: '1px solid #2a2a2a', borderRadius: 14, padding: 32 }}>
                    {/* Timer */}
                    <div style={{ textAlign: 'center', marginBottom: 28 }}>
                      <div style={{ color: '#64748B', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 6 }}>
                        Time Since Last Dispatch
                      </div>
                      <div style={{
                        fontSize: 52,
                        fontWeight: 800,
                        fontVariantNumeric: 'tabular-nums',
                        color: timerVisible ? timerColor : 'transparent',
                        transition: timerFlashing ? 'none' : 'color 0.3s',
                        letterSpacing: '-0.02em',
                      }}>
                        {timerStr}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 6 }}>
                        <span style={{ color: '#64748B', fontSize: 11 }}>Target: {targetSeconds}s</span>
                        {lastDispatchAt !== null && (
                          <button
                            onClick={() => { setLastDispatchAt(null); setDispatchElapsed(0); }}
                            style={{ background: 'none', border: '1px solid #2a2a2a', color: '#64748B', fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Reset timer
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Group size counter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                      <button
                        onClick={() => setDispatchGroupSize((v) => Math.max(0, v - 1))}
                        className="flex items-center justify-center rounded-xl bg-transparent border-2 border-red-400 text-red-400 text-3xl font-black active:bg-red-900/20 transition-colors touch-manipulation"
                        style={{ minWidth: 72, minHeight: 72 }}
                      >
                        −
                      </button>
                      <div style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: 56, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: dispatchGroupSize > 0 ? '#F1F5F9' : '#475569' }}>
                          {dispatchGroupSize}
                        </div>
                        <div style={{ color: '#64748B', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>guests</div>
                      </div>
                      <button
                        onClick={() => setDispatchGroupSize((v) => Math.min(30, v + 1))}
                        className="flex items-center justify-center rounded-xl bg-transparent border-2 border-[#22C55E] text-[#22C55E] text-3xl font-black active:bg-green-900/20 transition-colors touch-manipulation"
                        style={{ minWidth: 72, minHeight: 72 }}
                      >
                        +
                      </button>
                    </div>

                    {/* Dispatch button */}
                    <button
                      onClick={handleDispatch}
                      disabled={dispatchGroupSize === 0 || dispatching}
                      style={{
                        width: '100%',
                        padding: '18px 0',
                        fontSize: 18,
                        fontWeight: 800,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        borderRadius: 12,
                        border: 'none',
                        cursor: dispatchGroupSize === 0 || dispatching ? 'not-allowed' : 'pointer',
                        background: dispatchGroupSize === 0 || dispatching ? '#1a2a1a' : '#2563EB',
                        color: dispatchGroupSize === 0 || dispatching ? '#374151' : '#fff',
                        transition: 'background 0.15s, color 0.15s',
                        marginBottom: 20,
                      }}
                      className="touch-manipulation active:bg-[#1D4ED8]"
                    >
                      {dispatching ? 'Dispatching...' : 'Dispatch'}
                    </button>

                    {/* Today's dispatches summary */}
                    <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: 16 }}>
                      <p style={{ color: '#64748B', fontSize: 12, margin: '0 0 10px 0' }}>
                        {totalDispatches} dispatch{totalDispatches !== 1 ? 'es' : ''} · {totalGuests} guests today
                      </p>
                      {dispatchLogs.slice(0, 5).map((log) => {
                        const t = new Date(log.dispatched_at);
                        const h = t.getHours();
                        const m = t.getMinutes();
                        const ampm = h >= 12 ? 'PM' : 'AM';
                        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
                        const timeStr = `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
                        return (
                          <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', color: '#94A3B8', fontSize: 13, padding: '4px 0' }}>
                            <span>{timeStr}</span>
                            <span style={{ color: '#F1F5F9' }}>{log.group_size} guests</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              );
            })()}

            {/* ── Queue Time Control ── */}
            <section style={{ marginBottom: 48 }}>
              <div className="flex items-center gap-2.5 mb-5">
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6' }} />
                <h2 style={{ color: '#94A3B8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, margin: 0 }}>Queue Time</h2>
              </div>

              <div style={{ background: '#111111', border: '1px solid #2a2a2a', borderRadius: 14, padding: 32 }}>
                {selected.attraction_type === 'show' ? (
                  <div className="text-center py-4">
                    <div className={`text-3xl font-black ${
                      selected.status === 'OPEN' ? 'text-[#22C55E]' :
                      selected.status === 'CLOSED' ? 'text-[#dc3545]' :
                      'text-[#f0ad4e]'
                    }`}>
                      {selected.status === 'DELAYED' && delayStartedAt
                        ? `DELAYED — ${formatElapsed(delayElapsed)}`
                        : selected.status}
                    </div>
                  </div>
                ) : selected.status === 'CLOSED' || selected.status === 'DELAYED' ? (
                  <div className="text-center py-4">
                    <div className={`text-4xl font-black ${
                      selected.status === 'CLOSED' ? 'text-[#dc3545]' : 'text-[#f0ad4e]'
                    }`}>
                      {selected.status === 'DELAYED' && delayStartedAt
                        ? `DELAYED — ${formatElapsed(delayElapsed)}`
                        : selected.status}
                    </div>
                    <p className="text-white/30 text-xs mt-2">
                      {selected.status === 'CLOSED'
                        ? 'Contact control to open your attraction'
                        : 'Contact control to re-open your attraction'}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Inline stepper: [-5]  TIME  [+5] */}
                    <div className="flex items-center gap-6">
                      <button
                        onClick={() => handleWaitTimeUpdate(-5)}
                        disabled={selected.wait_time <= 0}
                        className="flex items-center justify-center rounded-xl bg-transparent border-2 border-red-400
                                   text-red-400 text-3xl font-black active:bg-red-900/20
                                   transition-colors touch-manipulation disabled:opacity-20 disabled:cursor-not-allowed
                                   min-w-[80px] min-h-[80px]"
                      >
                        -5
                      </button>

                      <div className="flex-1 text-center">
                        <div className={`text-5xl font-black tabular-nums ${
                          selected.status === 'OPEN' ? 'text-[#22C55E]' :
                          selected.status === 'AT CAPACITY' ? 'text-[#F59E0B]' :
                          'text-[#f0ad4e]'
                        }`}>
                          {selected.wait_time}
                          <span className="text-xl text-white/30 ml-1">min</span>
                        </div>
                        <p className={`text-[10px] mt-0.5 font-semibold uppercase tracking-wider ${
                          selected.status === 'OPEN' ? 'text-[#22C55E]/50' :
                          'text-[#f0ad4e]/50'
                        }`}>
                          {selected.status}
                        </p>
                      </div>

                      <button
                        onClick={() => handleWaitTimeUpdate(5)}
                        className="flex items-center justify-center rounded-xl bg-transparent border-2 border-[#22C55E]
                                   text-[#22C55E] text-3xl font-black active:bg-green-900/20
                                   transition-colors touch-manipulation
                                   min-w-[80px] min-h-[80px]"
                      >
                        +5
                      </button>
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* ── Hourly Throughput (view + hold-to-edit) ── */}
            {selected.attraction_type !== 'show' && hourlySlots.length > 0 && (
              <section style={{ marginBottom: 48 }}>
                <div className="flex items-center gap-2.5 mb-5">
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6' }} />
                  <h2 style={{ color: '#94A3B8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, margin: 0 }}>Hourly Throughput</h2>
                </div>
                <div style={{ background: '#111111', border: '1px solid #2a2a2a', borderRadius: 14, overflow: 'hidden' }}>
                  {hourlySlots.map((slot, idx) => {
                    const count = getDispatchCountForSlot(slot);
                    const isCurrent = idx === currentSlotIndex;
                    const isPast = idx < currentSlotIndex;
                    return (
                      <div
                        key={slot.start}
                        onMouseDown={() => {
                          longPressTimer.current = setTimeout(() => {
                            setEditSlot(slot);
                            setEditValue(String(count));
                          }, 600);
                        }}
                        onMouseUp={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                        onMouseLeave={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                        onTouchStart={() => {
                          longPressTimer.current = setTimeout(() => {
                            setEditSlot(slot);
                            setEditValue(String(count));
                          }, 600);
                        }}
                        onTouchEnd={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '14px 20px',
                          borderTop: idx === 0 ? 'none' : '1px solid #1a1a1a',
                          background: isCurrent ? 'rgba(59,130,246,0.06)' : 'transparent',
                          borderLeft: isCurrent ? '3px solid #3B82F6' : '3px solid transparent',
                          cursor: 'default',
                          userSelect: 'none',
                        }}
                      >
                        <span style={{ color: isCurrent ? '#F1F5F9' : isPast ? '#94A3B8' : '#64748B', fontSize: 14, fontWeight: isCurrent ? 600 : 400 }}>
                          {formatSlotTime(slot.start)} – {formatSlotTime(slot.end)}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {count > 0 ? (
                            <span style={{ color: isCurrent ? '#F1F5F9' : '#94A3B8', fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                              {count}
                            </span>
                          ) : (
                            <span style={{ color: '#374151', fontSize: 13 }}>
                              {isCurrent ? 'In progress' : isPast ? '—' : ''}
                            </span>
                          )}
                          <span style={{ color: '#2a2a2a', fontSize: 11 }}>hold to edit</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Edit Throughput Modal ── */}
            {editSlot && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4">
                <div style={{ width: '100%', maxWidth: 320, background: '#111111', border: '1px solid #2a2a2a', borderRadius: 14, padding: 24 }}>
                  <p style={{ color: '#94A3B8', fontSize: 12, textAlign: 'center', marginBottom: 4 }}>
                    {formatSlotTime(editSlot.start)} – {formatSlotTime(editSlot.end)}
                  </p>
                  <p style={{ color: '#F1F5F9', fontSize: 14, textAlign: 'center', marginBottom: 20 }}>Edit guest count</p>
                  <div style={{ background: '#000', border: '1px solid #2a2a2a', borderRadius: 8, padding: '16px', textAlign: 'center', marginBottom: 16 }}>
                    <span style={{ color: '#F1F5F9', fontSize: 48, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {editValue || '0'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2" style={{ marginBottom: 12 }}>
                    {['1','2','3','4','5','6','7','8','9'].map((k) => (
                      <button key={k} onClick={() => setEditValue((v) => { const n = v + k; return parseInt(n, 10) > 9999 ? v : n; })}
                        style={{ padding: '14px 0', fontSize: 20, fontWeight: 700, color: '#F1F5F9', background: '#000', border: '1px solid #2a2a2a', borderRadius: 8 }}
                        className="active:bg-[#1a1a1a] transition-colors touch-manipulation">{k}</button>
                    ))}
                    <button onClick={() => setEditValue('')}
                      style={{ padding: '14px 0', fontSize: 13, fontWeight: 700, color: '#EF4444', background: '#000', border: '1px solid #2a2a2a', borderRadius: 8 }}
                      className="active:bg-[#EF4444]/10 transition-colors touch-manipulation">CLR</button>
                    <button onClick={() => setEditValue((v) => { const n = v + '0'; return parseInt(n, 10) > 9999 ? v : n; })}
                      style={{ padding: '14px 0', fontSize: 20, fontWeight: 700, color: '#F1F5F9', background: '#000', border: '1px solid #2a2a2a', borderRadius: 8 }}
                      className="active:bg-[#1a1a1a] transition-colors touch-manipulation">0</button>
                    <button onClick={() => setEditValue((v) => v.slice(0, -1))}
                      style={{ padding: '14px 0', fontSize: 13, fontWeight: 700, color: '#F59E0B', background: '#000', border: '1px solid #2a2a2a', borderRadius: 8 }}
                      className="active:bg-[#F59E0B]/10 transition-colors touch-manipulation">DEL</button>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => { setEditSlot(null); setEditValue(''); }}
                      style={{ flex: 1, padding: '13px 0', fontSize: 14, fontWeight: 600, color: '#94A3B8', background: 'transparent', border: '1px solid #2a2a2a', borderRadius: 8, cursor: 'pointer' }}
                      className="active:bg-[#1a1a1a] transition-colors touch-manipulation">Cancel</button>
                    <button onClick={async () => { await saveSlotOverride(editSlot, parseInt(editValue, 10) || 0); setEditSlot(null); setEditValue(''); }}
                      style={{ flex: 1, padding: '13px 0', fontSize: 14, fontWeight: 700, color: '#fff', background: '#2563EB', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                      className="active:bg-[#1D4ED8] transition-colors touch-manipulation">Save</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Field Notes Button ── */}
            {selected.attraction_type !== 'show' && (
              <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={() => setNotesOpen(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 20px',
                    background: '#111111', border: '1px solid #2a2a2a', borderRadius: 10,
                    color: '#94A3B8', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#F1F5F9'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#94A3B8'; }}
                >
                  📝 Show Report
                </button>
              </div>
            )}

          </>
        )}
      </div>

      {/* ── Field Notes Drawer ── */}
      {notesOpen && selected && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.85)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setNotesOpen(false); }}
        >
          <div
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: '85%', background: '#111111',
              borderTop: '1px solid #2a2a2a',
              borderRadius: '16px 16px 0 0',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Drawer header */}
            <div style={{ flexShrink: 0, padding: '16px 20px', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: 0, color: '#F1F5F9', fontSize: 16, fontWeight: 700 }}>Show Report — {selected.name}</p>
                <p style={{ margin: 0, color: '#94A3B8', fontSize: 11, marginTop: 2 }}>
                  {notesSaving === 'saving' ? 'Saving...' :
                   notesSaving === 'saved' && notesLastSaved ? `Saved ${new Date(notesLastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` :
                   notesSaving === 'error' ? 'Save failed' :
                   'Auto-saves every 2 seconds'}
                </p>
              </div>
              <button
                onClick={() => setNotesOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: 22, cursor: 'pointer', padding: '4px 8px', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
            {/* Drawer body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ margin: 0, color: '#94A3B8', fontSize: 12 }}>Notes auto-save every 2 seconds. Submit final report via Sign-Off.</p>
              {([
                { key: 'operational_report', label: 'Operational' },
                { key: 'technical_report', label: 'Technical' },
                { key: 'costume_report', label: 'Costume' },
                { key: 'construction_report', label: 'Construction' },
                { key: 'additional_notes', label: 'Additional Notes' },
              ] as { key: keyof typeof notesData; label: string }[]).map(({ key, label }) => (
                <div key={key}>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</label>
                  <textarea
                    value={notesData[key]}
                    onChange={(e) => handleNotesChange(key, e.target.value)}
                    rows={4}
                    placeholder={`${label} notes...`}
                    style={{
                      width: '100%', background: '#000000', border: '1px solid #2a2a2a', borderRadius: 8,
                      color: '#F1F5F9', fontSize: 14, padding: '10px 12px', resize: 'vertical',
                      fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Sticky Footer — Guest Stats ── */}
      {selected && (
        <footer style={{ flexShrink: 0, background: '#111111', borderTop: '1px solid #2a2a2a', padding: '20px 24px' }}>
          <div className="flex items-center justify-between">
            <div>
              <div style={{ color: '#94A3B8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 4 }}>
                {selected.name} Tonight
              </div>
              <div style={{ color: '#22C55E', fontSize: 24, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {guestsTonight.toLocaleString()}
                <span style={{ color: '#94A3B8', fontSize: 13, marginLeft: 6 }}>guests</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#94A3B8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 4 }}>
                Park Total
              </div>
              <div style={{ color: '#F1F5F9', fontSize: 24, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {totalGuestsAllAttractions.toLocaleString()}
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
