'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { checkAuth, clearAuthCache } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { getAttractionLogo, getLogoGlow, getGlowRgb } from '@/lib/logos';
import { getSignoffStatus } from '@/lib/signoff';
import type { AttractionSignoffStatus } from '@/lib/signoff';
import type { Attraction, ThroughputLog, DispatchLog, OperatorSession } from '@/types/database';
import { saveShowReportDraft, getExistingReport } from '@/lib/showReport';
import AppSwitcher from '@/components/AppSwitcher';
import { surface, border, text, accents, radius, statusColors, FONT_NUM, microLabel, card, controlButton, primaryButton } from '@/lib/theme';
import NumericKeypad from '@/components/ui/NumericKeypad';
import OfflineBanner from '@/components/ui/OfflineBanner';
import PinPad from '@/components/ui/PinPad';
import { useToasts, ToastStack } from '@/components/ui/Toast';
import useOperatorSession from '@/hooks/useOperatorSession';
import OperatorChip from '@/components/OperatorChip';

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
  const [ch, cm] = closeTime.split(':').map(Number);
  // Floor start to the nearest hour so slots always land on whole hours
  // (e.g. 19:30 open → start at 19:00, not 19:30)
  let startMinutes = oh * 60; // intentionally drop minutes
  let endMinutes = ch * 60 + (cm || 0);
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
  const [parkGuests, setParkGuests] = useState(0); // all-attraction dispatch total tonight
  const [lastDispatchAt, setLastDispatchAt] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [showAllDispatches, setShowAllDispatches] = useState(false);
  const [groupSizePadOpen, setGroupSizePadOpen] = useState(false);
  const [groupSizePadInput, setGroupSizePadInput] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [signoffStatus, setSignoffStatus] = useState<AttractionSignoffStatus | null>(null);
  const [delayStartedAt, setDelayStartedAt] = useState<string | null>(null);
  const [delayElapsed, setDelayElapsed] = useState(0);
  const { toasts, pushToast } = useToasts();

  // Operator session — per-attraction "who's on the panel" state
  const { session: operatorSession, loading: operatorLoading, login: operatorLogin, changeOperator, endShift } = useOperatorSession(
    selectedId,
    attractions.find((a) => a.id === selectedId)?.name ?? '',
  );
  const [lockPinOpen, setLockPinOpen] = useState(false);
  const [lastSession, setLastSession] = useState<OperatorSession | null>(null);

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

  // Tablet-first layout: 2-column grid on iPad-width viewports and up.
  // Initialised in an effect (default false) to avoid SSR hydration mismatch.
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setWide(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setWide(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Auth & initial data fetch
  useEffect(() => {
    let attractionsChannel: ReturnType<typeof supabase.channel> | null = null;
    let logsChannel: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      const auth = await checkAuth();
      if (!auth.authenticated || !auth.role) {
        window.location.href = '/control/login';
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

      const [attractionsRes, settingsRes, throughputRes] = await Promise.all([
        attractionsQuery,
        supabase.from('park_settings').select('key,value'),
        supabase
          .from('throughput_logs')
          .select('id,attraction_id,slot_start,slot_end,guest_count,logged_by,log_date,created_at,updated_at')
          .eq('log_date', getTodayDateStr()),
      ]);
      if (!throughputRes.error && throughputRes.data) {
        setThroughputLogs(throughputRes.data);
      }
      if (settingsRes.data) {
        for (const s of settingsRes.data) {
          if (s.key === 'opening_time') setOpeningTime(s.value);
          if (s.key === 'closing_time') setClosingTime(s.value);
        }
      }

      if (!attractionsRes.error && attractionsRes.data) {
        setAttractions(attractionsRes.data);
        // Restore last-selected attraction, fall back to first ride
        const saved = typeof window !== 'undefined' ? localStorage.getItem('ic-control-selected') : null;
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

  // Fetch the most recent ended session today (shown under the lock card)
  useEffect(() => {
    if (!selectedId || operatorSession) { setLastSession(null); return; }
    let cancelled = false;
    async function fetchLast() {
      const { data } = await supabase
        .from('operator_sessions')
        .select('*')
        .eq('attraction_id', selectedId!)
        .eq('log_date', getTodayDateStr())
        .not('ended_at', 'is', null)
        .order('ended_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setLastSession((data as OperatorSession) || null);
    }
    fetchLast();
    return () => { cancelled = true; };
  }, [selectedId, operatorSession]);

  // Fetch dispatch logs when selectedId changes
  useEffect(() => {
    if (!selectedId) { setDispatchLogs([]); setLastDispatchAt(null); return; }

    let dispatchChannel: ReturnType<typeof supabase.channel> | null = null;

    async function fetchDispatchLogs(attractionId: string) {
      const today = getTodayDateStr();
      const { data } = await supabase.from('dispatch_logs')
        .select('*').eq('attraction_id', attractionId).eq('log_date', today)
        .order('dispatched_at', { ascending: false }).limit(200);
      setDispatchLogs(data || []);
      const latest = (data || [])[0];
      // Respect a locally persisted reset — if the reset happened after the
      // last dispatch, keep the timer blank until a new dispatch is logged.
      const resetTime = typeof window !== 'undefined'
        ? localStorage.getItem(`ic-dispatch-reset-${attractionId}`)
        : null;
      if (latest && resetTime && new Date(latest.dispatched_at) < new Date(resetTime)) {
        setLastDispatchAt(null);
      } else if (latest) {
        setLastDispatchAt(latest.dispatched_at);
      } else {
        setLastDispatchAt(null);
      }
    }

    fetchDispatchLogs(selectedId);
    setDispatchGroupSize(0);

    dispatchChannel = supabase
      .channel(`dispatch-logs-${selectedId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dispatch_logs', filter: `attraction_id=eq.${selectedId}` },
        (payload) => {
          const today = getTodayDateStr();
          if (payload.eventType === 'INSERT') {
            const newLog = payload.new as DispatchLog;
            if (newLog.log_date !== today) return;
            setDispatchLogs((prev) =>
              prev.some((l) => l.id === newLog.id)
                ? prev
                : [newLog, ...prev].slice(0, 200)
            );
            setLastDispatchAt((prev) =>
              !prev || new Date(newLog.dispatched_at) > new Date(prev)
                ? newLog.dispatched_at
                : prev
            );
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as DispatchLog;
            setDispatchLogs((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as DispatchLog;
            setDispatchLogs((prev) => prev.filter((l) => l.id !== deleted.id));
          }
        }
      )
      .subscribe();

    return () => {
      if (dispatchChannel) supabase.removeChannel(dispatchChannel);
    };
  }, [selectedId]);

  // Park-wide guest total — sum of ALL attractions' dispatches tonight, kept
  // live by its own unfiltered subscription (the per-attraction channel above
  // only covers the selected attraction).
  useEffect(() => {
    const today = getTodayDateStr();
    async function loadParkGuests() {
      const { data } = await supabase
        .from('dispatch_logs')
        .select('group_size')
        .eq('log_date', today);
      setParkGuests((data || []).reduce((s, l) => s + (l.group_size || 0), 0));
    }
    loadParkGuests();

    const channel = supabase
      .channel('control-park-dispatch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dispatch_logs' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as DispatchLog;
          if (row.log_date === today) setParkGuests((g) => g + (row.group_size || 0));
        } else {
          // UPDATE/DELETE (e.g. Clear logs) — refetch the authoritative sum
          loadParkGuests();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Consolidated 1s clock tick — drives current-slot highlighting and the
  // dispatch elapsed timer (derived below); over-target flash is pure CSS.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Dispatch elapsed derived from the shared clock tick
  const dispatchElapsed = useMemo(
    () => (lastDispatchAt ? Math.max(0, Math.floor((now - new Date(lastDispatchAt).getTime()) / 1000)) : 0),
    [now, lastDispatchAt]
  );

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
        pushToast('error', 'Failed to save show report notes');
      }
    }, 2000);
  }

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

  // Fully signed off today = all opening sections complete
  const fullySignedOff = !!signoffStatus && signoffStatus.openingTotal > 0 && signoffStatus.openingCompleted === signoffStatus.openingTotal;
  // CLOSED reads as NOT SIGNED OFF until the opening sign-off is complete
  const displayStatus = selected && selected.status === 'CLOSED' && !fullySignedOff ? 'NOT SIGNED OFF' : selected?.status;
  // Panel is locked until an operator picks up the shift via PIN
  const panelLocked = !operatorLoading && !operatorSession;

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

  // Total guests across ALL attractions tonight — from dispatches (the real
  // source of guests-through), kept live by its own park-wide subscription.
  const totalGuestsAllAttractions = parkGuests;

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

  /** Returns true on success; false (with error toast) on failure. */
  async function saveSlotOverride(slot: { start: string; end: string }, count: number): Promise<boolean> {
    const today = getTodayDateStr();
    try {
      const { error } = await supabase.from('throughput_logs').upsert({
        attraction_id: selectedId,
        slot_start: slot.start,
        slot_end: slot.end,
        guest_count: count,
        logged_by: displayName || userEmail,
        log_date: today,
      }, { onConflict: 'attraction_id,log_date,slot_start' });
      if (error) {
        pushToast('error', 'Failed to save throughput — try again');
        return false;
      }
      // Refresh throughput logs
      const { data } = await supabase.from('throughput_logs')
        .select('id,attraction_id,slot_start,slot_end,guest_count,logged_by,log_date,created_at,updated_at')
        .eq('attraction_id', selectedId ?? '').eq('log_date', today);
      setThroughputLogs(data || []);
      pushToast('success', 'Throughput updated');
      return true;
    } catch {
      pushToast('error', 'Failed to save throughput — try again');
      return false;
    }
  }

  // Handle queue time update
  async function handleWaitTimeUpdate(delta: number) {
    if (!selected) return;
    const oldTime = selected.wait_time || 0;
    const newTime = Math.max(0, Math.min(180, oldTime + delta));
    if (newTime === oldTime) return;
    const { error } = await supabase
      .from('attractions')
      .update({ wait_time: newTime, updated_at: new Date().toISOString() })
      .eq('id', selected.id);
    if (error) {
      pushToast('error', 'Failed to update queue time');
      return;
    }

    logAudit({
      actionType: 'queue_time_change',
      attractionId: selected.id,
      attractionName: selected.name,
      performedBy: operatorSession?.operator_name || displayName || userEmail,
      oldValue: String(oldTime),
      newValue: String(newTime),
      details: `Wait time changed from ${oldTime}min to ${newTime}min`,
    });
  }

  async function handleDispatch() {
    if (dispatchGroupSize === 0 || dispatching || !selectedId) return;
    setDispatching(true);
    const today = getTodayDateStr();
    const { data, error } = await supabase.from('dispatch_logs').insert({
      attraction_id: selectedId,
      group_size: dispatchGroupSize,
      dispatched_by: operatorSession?.operator_name || displayName || userEmail,
      log_date: today,
    }).select('*').single();
    if (error) {
      pushToast('error', 'Dispatch failed to log — try again');
      setDispatching(false);
      return;
    }
    setDispatchGroupSize(0);
    if (data) {
      setDispatchLogs((prev) => [data as DispatchLog, ...prev].slice(0, 200));
      setLastDispatchAt((data as DispatchLog).dispatched_at);
    } else {
      setLastDispatchAt(new Date().toISOString());
    }
    // Clear any manual reset so the new dispatch shows correctly after navigation
    if (selectedId && typeof window !== 'undefined') localStorage.removeItem(`ic-dispatch-reset-${selectedId}`);
    setDispatching(false);
  }

  async function handleLogout() {
    clearAuthCache(); await supabase.auth.signOut();
    window.location.href = '/control/login';
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: surface.page }}>
        <div className="text-2xl font-bold animate-pulse" style={{ color: text.primary }}>Loading...</div>
      </div>
    );
  }

  if (rides.length === 0) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: surface.page, padding: '0 24px' }}>
        <div className="text-center">
          <p className="text-lg mb-4" style={{ color: text.secondary }}>No rides configured.</p>
          <p className="text-sm" style={{ color: text.faint }}>Ask a manager to add rides in the Admin panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: surface.page, color: text.primary }}>
      <style>{`@keyframes ic-dispatch-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } } .ic-dispatch-blink { animation: ic-dispatch-blink 1s steps(1, end) infinite; }`}</style>
      <OfflineBanner />
      {/* Header */}
      <div style={{ background: surface.card, borderBottom: `1px solid ${border.default}`, height: 56, padding: '0 20px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AppSwitcher currentApp="control" isAdmin={userRole === 'admin'} />
          <a href="/control" style={{ textDecoration: 'none' }}>
            <h1 style={{ color: text.primary, fontSize: 15, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>Control</h1>
          </a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: text.secondary }}>
          {selected && (
            <OperatorChip
              session={operatorSession}
              attractionName={selected.name}
              verifyPin={changeOperator}
              onEndShift={endShift}
            />
          )}
          {(displayName || userEmail) && <span title={userEmail} style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="hidden sm:inline">{displayName || userEmail}</span>}
          {'Notification' in (typeof window !== 'undefined' ? window : {}) && notifPermission !== 'denied' && (
            <button
              onClick={handleNotifToggle}
              title={notifEnabled ? 'Notifications on — click to disable' : 'Enable status notifications'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 4, color: notifEnabled ? '#4ADE80' : text.faint, transition: 'color 0.15s', lineHeight: 1 }}
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
              ...controlButton,
              background: 'none',
              padding: '5px 10px',
              borderRadius: radius.sm,
              fontSize: 12,
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = accents.control.base;
              e.currentTarget.style.color = text.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = border.strong;
              e.currentTarget.style.color = text.secondary;
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
        style={{ background: surface.card, borderBottom: `1px solid ${border.default}`, padding: '0 20px', flexShrink: 0, display: 'flex', gap: 0, overflowX: 'auto' }}
      >
        {rides.map((a) => {
          const isSelected = a.id === selectedId;
          const tabGlowRgb = getGlowRgb(a.slug) || '148, 163, 184';
          return (
            <button
              key={a.id}
              onClick={() => { setSelectedId(a.id); if (typeof window !== 'undefined') localStorage.setItem('ic-control-selected', a.id); }}
              style={{
                flexShrink: 0,
                color: isSelected ? text.primary : text.muted,
                fontSize: 14,
                fontWeight: isSelected ? 600 : 500,
                padding: '16px 14px',
                minHeight: 52,
                borderRadius: isSelected ? '10px 10px 0 0' : 0,
                background: isSelected ? `rgba(${tabGlowRgb}, 0.12)` : 'transparent',
                border: 'none',
                boxShadow: isSelected ? `inset 1px 1px 0 rgba(${tabGlowRgb}, 0.3), inset -1px 0 0 rgba(${tabGlowRgb}, 0.3)` : 'none',
                borderBottom: isSelected ? `2px solid rgba(${tabGlowRgb}, 0.9)` : '2px solid transparent',
                cursor: 'pointer',
                transition: 'color 0.15s, border-color 0.15s, background 0.15s',
                touchAction: 'manipulation',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.color = text.secondary;
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.color = text.muted;
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

      {/* Main Content — viewport-locked grid in wide mode, scrollable column on phones */}
      <div
        style={
          wide
            ? { flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '12px 20px', overflow: 'hidden' }
            : { flex: 1, overflowY: 'auto', padding: '32px 24px' }
        }
      >
        {selected && (() => {
            // Layout-only restructure: each block is built once, then slotted
            // into either the single-column (phone) or 2-column (tablet) layout.
            const gatedStyle = panelLocked ? { opacity: 0.35, pointerEvents: 'none' as const, userSelect: 'none' as const } : undefined;

            {/* ── Attraction Logo + Status + Show Report ── */}
            const heroBlock = (() => {
              const logo = getAttractionLogo(selected.slug);
              const glow = getLogoGlow(selected.slug);
              const heroGlowRgb = getGlowRgb(selected.slug) || '148, 163, 184';
              const st = selected.status as string;
              const sc = statusColors(st);
              return (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: wide ? 8 : 12,
                  // Hero wash — attraction-tinted gradient. Bleeds edge-to-edge on
                  // phones; wraps just the left column as a rounded panel on tablets.
                  // Wide: fixed-height flex child — never grows or shrinks the column.
                  ...(wide ? { flexShrink: 0 as const } : {}),
                  margin: wide ? 0 : '-32px -24px 24px',
                  padding: wide ? '12px 16px' : '32px 24px 24px',
                  borderRadius: wide ? radius.xl : 0,
                  background: `linear-gradient(160deg, rgba(${heroGlowRgb}, 0.14) 0%, ${surface.page} 70%)`,
                }}>
                  {logo && (
                    <img src={logo} alt={selected.name} loading="lazy" decoding="async" className="object-contain w-[100px] sm:w-[160px]" style={{ height: 'auto', maxHeight: wide ? 'clamp(56px, 10vh, 90px)' : 100, filter: glow || undefined }} />
                  )}
                  {/* Wide: status pill + Show Report sit on one row to save height */}
                  <div style={{ display: 'flex', flexDirection: wide ? 'row' : 'column', alignItems: 'center', gap: wide ? 12 : 12 }}>
                    {/* Attraction status — prominent */}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
                      padding: '7px 18px', borderRadius: radius.pill,
                      background: sc.soft, color: sc.text, border: `1px solid ${sc.rail}40`,
                      ...FONT_NUM,
                    }}>
                      {st === 'DELAYED' && delayStartedAt
                        ? `DELAYED — ${formatElapsed(delayElapsed)}`
                        : st === 'CLOSED' && !fullySignedOff
                        ? 'NOT SIGNED OFF'
                        : st}
                    </span>
                    {/* Show Report button — always visible under logo */}
                    {selected.attraction_type !== 'show' && (
                      <button
                        onClick={() => setNotesOpen(true)}
                        style={{
                          ...controlButton,
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: wide ? '8px 16px' : '12px 20px', minHeight: wide ? 38 : 44,
                          fontSize: 13, fontWeight: 600,
                          transition: 'border-color 0.15s, color 0.15s',
                          touchAction: 'manipulation',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = accents.control.base; e.currentTarget.style.color = text.primary; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = border.strong; e.currentTarget.style.color = text.secondary; }}
                      >
                        📝 Show Report
                      </button>
                    )}
                  </div>
                </div>
              );
            })();

            {/* ── Dispatch Clicker (operator-gated) ── */}
            const dispatchSection = selected.attraction_type !== 'show' && (() => {
              const targetSeconds = selected.target_dispatch_seconds ?? 90;
              const timerColor = lastDispatchAt === null ? '#64748B'
                : dispatchElapsed > targetSeconds + 30 ? '#EF4444'
                : dispatchElapsed > targetSeconds ? '#EF4444'
                : dispatchElapsed > targetSeconds * 0.75 ? '#F59E0B'
                : '#22C55E';
              const timerFlashing = lastDispatchAt !== null && dispatchElapsed > targetSeconds + 30;

              const dispatchMin = Math.floor(dispatchElapsed / 60);
              const dispatchSec = dispatchElapsed % 60;
              const timerStr = lastDispatchAt === null
                ? '—:—'
                : `${String(dispatchMin).padStart(2, '0')}:${String(dispatchSec).padStart(2, '0')}`;

              const totalDispatches = dispatchLogs.length;
              const totalGuests = dispatchLogs.reduce((s, l) => s + l.group_size, 0);
              const cardGlowRgb = getGlowRgb(selected.slug) || '148, 163, 184';

              return (
                <section style={wide
                  ? { marginBottom: 0, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }
                  : { marginBottom: 48 }}>
                  <div className="flex items-center gap-2.5" style={{ marginBottom: wide ? 8 : 20, ...(wide ? { flexShrink: 0 } : {}) }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: accents.control.base }} />
                    <h2 style={{ ...microLabel, color: text.secondary, fontSize: 11, margin: 0 }}>Dispatch</h2>
                  </div>

                  <div style={{
                    ...card(selected.status),
                    padding: wide ? 16 : 32,
                    // Subtle attraction art-wash — status rail stays load-bearing on the left
                    background: `linear-gradient(105deg, rgba(${cardGlowRgb}, 0.08) 0%, ${surface.card} 55%)`,
                    // Wide: dispatch card absorbs the column's spare height; internals
                    // vertically centred so it never pushes the page taller.
                    ...(wide ? { flex: 1, minHeight: 0, display: 'flex' as const, flexDirection: 'column' as const, justifyContent: 'center' as const, overflow: 'hidden' as const } : {}),
                  }}>
                    {/* Timer */}
                    <div style={{ textAlign: 'center', marginBottom: wide ? 14 : 28 }}>
                      <div style={{ ...microLabel, fontSize: 11, marginBottom: 6 }}>
                        Time Since Last Dispatch
                      </div>
                      <div className={timerFlashing ? 'ic-dispatch-blink' : undefined} style={{
                        fontSize: wide ? 'clamp(28px, 5vh, 44px)' : 52,
                        fontWeight: 800,
                        ...FONT_NUM,
                        color: timerColor,
                        transition: timerFlashing ? 'none' : 'color 0.3s',
                        letterSpacing: '-0.02em',
                      }}>
                        {timerStr}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 6 }}>
                        <span style={{ color: text.muted, fontSize: 11, ...FONT_NUM }}>Target: {targetSeconds}s</span>
                        {lastDispatchAt !== null && (
                          <button
                            onClick={() => {
                              setLastDispatchAt(null);
                              if (selectedId && typeof window !== 'undefined') localStorage.setItem(`ic-dispatch-reset-${selectedId}`, new Date().toISOString());
                            }}
                            style={{ ...controlButton, background: 'none', color: text.muted, fontSize: 11, padding: '4px 10px', borderRadius: radius.sm }}
                          >
                            Reset timer
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Group size counter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: wide ? 14 : 24 }}>
                      <button
                        onClick={() => setDispatchGroupSize((v) => Math.max(0, v - 1))}
                        className="flex items-center justify-center rounded-xl bg-transparent border-2 border-red-400 text-red-400 text-3xl font-black active:bg-red-900/20 transition-colors touch-manipulation"
                        style={{ minWidth: wide ? 60 : 72, minHeight: wide ? 60 : 72 }}
                      >
                        −
                      </button>
                      <button
                        onClick={() => { setGroupSizePadInput(dispatchGroupSize > 0 ? String(dispatchGroupSize) : ''); setGroupSizePadOpen(true); }}
                        style={{ flex: 1, textAlign: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
                        title="Tap to enter number"
                      >
                        <div style={{ fontSize: wide ? 'clamp(32px, 6vh, 48px)' : 56, fontWeight: 900, ...FONT_NUM, color: dispatchGroupSize > 0 ? text.primary : text.faint }}>
                          {dispatchGroupSize}
                        </div>
                        <div style={{ ...microLabel, color: accents.control.base, fontSize: 11 }}>tap to enter</div>
                      </button>
                      <button
                        onClick={() => setDispatchGroupSize((v) => Math.min(30, v + 1))}
                        className="flex items-center justify-center rounded-xl bg-transparent border-2 border-[#22C55E] text-[#22C55E] text-3xl font-black active:bg-green-900/20 transition-colors touch-manipulation"
                        style={{ minWidth: wide ? 60 : 72, minHeight: wide ? 60 : 72 }}
                      >
                        +
                      </button>
                    </div>

                    {/* Dispatch button — locked when CLOSED or DELAYED */}
                    {(selected.status === 'CLOSED' || selected.status === 'DELAYED') ? (
                      <div style={{
                        width: '100%', padding: wide ? '14px 0' : '18px 0', marginBottom: wide ? 12 : 20,
                        background: statusColors(selected.status).soft,
                        border: `1px solid ${statusColors(selected.status).rail}40`,
                        borderRadius: radius.lg, textAlign: 'center',
                        color: statusColors(selected.status).text,
                        fontSize: 14, fontWeight: 600, letterSpacing: '0.04em',
                      }}>
                        {selected.status === 'CLOSED' ? 'Attraction closed — dispatch locked' : 'Attraction delayed — dispatch locked'}
                      </div>
                    ) : (
                      <button
                        onClick={handleDispatch}
                        disabled={dispatchGroupSize === 0 || dispatching}
                        style={{
                          ...primaryButton('control'),
                          width: '100%', minHeight: 56, padding: wide ? '14px 0' : '18px 0', fontSize: 18, fontWeight: 800,
                          letterSpacing: '0.06em', textTransform: 'uppercase',
                          cursor: dispatchGroupSize === 0 || dispatching ? 'not-allowed' : 'pointer',
                          background: dispatchGroupSize === 0 || dispatching ? surface.raised : accents.control.strong,
                          color: dispatchGroupSize === 0 || dispatching ? text.faint : '#fff',
                          transition: 'background 0.15s, color 0.15s', marginBottom: wide ? 12 : 20,
                        }}
                        className="touch-manipulation active:bg-[#1D4ED8]"
                      >
                        {dispatching ? 'Dispatching...' : 'Dispatch'}
                      </button>
                    )}

                    {/* Attribution hint */}
                    {operatorSession && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: text.faint, fontSize: 11, marginTop: wide ? -6 : -10, marginBottom: wide ? 10 : 16 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 3" />
                        </svg>
                        Dispatched by {operatorSession.operator_name} · logged automatically
                      </div>
                    )}

                    {/* Today's dispatches summary */}
                    <div style={{ borderTop: `1px solid ${border.divider}`, paddingTop: wide ? 10 : 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <p style={{ color: text.muted, fontSize: 12, margin: 0, ...FONT_NUM }}>
                          {totalDispatches} dispatch{totalDispatches !== 1 ? 'es' : ''} · {totalGuests} guests today
                        </p>
                        {totalDispatches > 1 && (
                          <button
                            onClick={() => setShowAllDispatches((v) => !v)}
                            style={{ background: 'none', border: 'none', color: accents.control.base, fontSize: 12, cursor: 'pointer', padding: '6px 0' }}
                          >
                            {showAllDispatches ? 'Show less' : `See all ${totalDispatches}`}
                          </button>
                        )}
                      </div>

                      {/* Most recent dispatch only by default */}
                      {dispatchLogs.slice(0, showAllDispatches ? dispatchLogs.length : 1).map((log) => {
                        const t = new Date(log.dispatched_at);
                        const h = t.getHours();
                        const m = t.getMinutes();
                        const ampm = h >= 12 ? 'PM' : 'AM';
                        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
                        const timeStr = `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
                        return (
                          <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', color: text.secondary, fontSize: 13, padding: '4px 0', borderTop: `1px solid ${border.divider}`, ...FONT_NUM }}>
                            <span>{timeStr}</span>
                            <span style={{ color: text.primary }}>{log.group_size} guests</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              );
            })();

            {/* ── Queue Time Control (operator-gated) ── */}
            const queueSection = (
            <section style={wide ? { marginBottom: 0, flexShrink: 0 } : { marginBottom: 48 }}>
              <div className="flex items-center gap-2.5" style={{ marginBottom: wide ? 8 : 20 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: accents.control.base }} />
                <h2 style={{ ...microLabel, color: text.secondary, fontSize: 11, margin: 0 }}>Queue Time</h2>
              </div>

              <div style={{ ...card(selected.status), padding: wide ? 16 : 32 }}>
                {selected.attraction_type === 'show' ? (
                  <div className="text-center py-4">
                    <div className="text-3xl font-black" style={{ color: statusColors(selected.status).text, ...FONT_NUM }}>
                      {selected.status === 'DELAYED' && delayStartedAt
                        ? `DELAYED — ${formatElapsed(delayElapsed)}`
                        : selected.status}
                    </div>
                  </div>
                ) : selected.status === 'CLOSED' || selected.status === 'DELAYED' ? (
                  <div className="text-center py-4">
                    <div className="text-4xl font-black" style={{ color: statusColors(selected.status).text, ...FONT_NUM }}>
                      {selected.status === 'DELAYED' && delayStartedAt
                        ? `DELAYED — ${formatElapsed(delayElapsed)}`
                        : displayStatus}
                    </div>
                    <p className="text-xs mt-2" style={{ color: text.muted }}>
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
                        <div className={wide ? 'font-black tabular-nums' : 'text-5xl font-black tabular-nums'} style={{ color: statusColors(selected.status).text, ...(wide ? { fontSize: 'clamp(36px, 7vh, 56px)', lineHeight: 1.1 } : {}) }}>
                          {selected.wait_time}
                          <span className="text-xl ml-1" style={{ color: text.muted }}>min</span>
                        </div>
                        <p className="text-[10px] mt-0.5 font-semibold uppercase tracking-wider" style={{ color: statusColors(selected.status).text, opacity: 0.6 }}>
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
            );

            {/* ── Lock overlay — no operator on shift ── */}
            const lockOverlay = (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 10,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: 24,
              }}>
                <div style={{
                  width: '100%', maxWidth: 360,
                  background: surface.card, border: `1px solid ${border.default}`, borderRadius: radius.xl,
                  padding: 28, textAlign: 'center',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: radius.md,
                    background: accents.control.soft,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 14,
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accents.control.base} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <p style={{ color: text.primary, fontSize: 15, fontWeight: 600, margin: 0 }}>Panel locked</p>
                  <p style={{ color: text.muted, fontSize: 12, margin: '6px 0 18px' }}>
                    Enter your PIN to take over as operator of {selected.name}
                  </p>
                  <button
                    onClick={() => setLockPinOpen(true)}
                    style={{ ...primaryButton('control'), width: '100%', minHeight: 48, padding: '13px 0', fontSize: 14, fontWeight: 700 }}
                    className="active:bg-[#1D4ED8] transition-colors touch-manipulation"
                  >
                    Enter PIN to operate
                  </button>
                </div>
                {lastSession && lastSession.ended_at && (
                  <div style={{
                    marginTop: 12, width: '100%', maxWidth: 360,
                    background: 'rgba(255,255,255,0.03)', borderRadius: radius.md,
                    padding: '8px 14px', textAlign: 'center',
                    color: text.faint, fontSize: 12, ...FONT_NUM,
                  }}>
                    Last operator&nbsp;&nbsp;{lastSession.operator_name} · until {new Date(lastSession.ended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            );

            {/* ── Hourly Throughput (view + hold-to-edit) ── */}
            const throughputSection = selected.attraction_type !== 'show' && hourlySlots.length > 0 && (
              <section style={wide
                ? { marginBottom: 0, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }
                : { marginBottom: 48 }}>
                <div className="flex items-center gap-2.5" style={{ marginBottom: wide ? 8 : 20, ...(wide ? { flexShrink: 0 } : {}) }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: accents.control.base }} />
                  <h2 style={{ ...microLabel, color: text.secondary, fontSize: 11, margin: 0 }}>Hourly Throughput</h2>
                </div>
                <div
                  // Scrolling this list must never trigger hold-to-edit
                  onScroll={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                  style={{
                    ...card(),
                    overflow: 'hidden',
                    // Wide mode: the slot list is the ONLY scrollable element on the
                    // page — it fills the column's remaining height and scrolls inside.
                    ...(wide ? { flex: 1, minHeight: 0, overflowY: 'auto' as const } : {}),
                  }}
                >
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
                          }, 650);
                        }}
                        onMouseUp={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                        onMouseLeave={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                        onTouchStart={() => {
                          longPressTimer.current = setTimeout(() => {
                            setEditSlot(slot);
                            setEditValue(String(count));
                          }, 650);
                        }}
                        // Finger moved = the user is scrolling, not holding — cancel the edit timer
                        onTouchMove={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                        onTouchEnd={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                        onTouchCancel={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '14px 20px',
                          borderTop: idx === 0 ? 'none' : `1px solid ${border.divider}`,
                          background: isCurrent ? accents.control.soft : 'transparent',
                          borderLeft: isCurrent ? `3px solid ${accents.control.base}` : '3px solid transparent',
                          cursor: 'default',
                          userSelect: 'none',
                        }}
                      >
                        <span style={{ color: isCurrent ? text.primary : isPast ? text.secondary : text.muted, fontSize: 14, fontWeight: isCurrent ? 600 : 400, ...FONT_NUM }}>
                          {formatSlotTime(slot.start)} – {formatSlotTime(slot.end)}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {count > 0 ? (
                            <span style={{ color: isCurrent ? text.primary : text.secondary, fontSize: 15, fontWeight: 700, ...FONT_NUM }}>
                              {count}
                            </span>
                          ) : (
                            <span style={{ color: text.faint, fontSize: 13 }}>
                              {isCurrent ? 'In progress' : isPast ? '—' : ''}
                            </span>
                          )}
                          <span style={{ color: text.faint, fontSize: 11 }}>hold to edit</span>
                          <button
                            aria-label={`Edit guest count for ${formatSlotTime(slot.start)}`}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (longPressTimer.current) clearTimeout(longPressTimer.current);
                              setEditSlot(slot);
                              setEditValue(String(count));
                            }}
                            style={{
                              width: 32, height: 32, flexShrink: 0,
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              background: 'none', border: 'none', borderRadius: radius.sm,
                              color: text.faint, cursor: 'pointer', padding: 0,
                              touchAction: 'manipulation',
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );

            {/* ── Edit Throughput Modal ── */}
            const editModal = editSlot && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4">
                <div style={{ ...card(), width: '100%', maxWidth: 320, padding: 28 }}>
                  <p style={{ ...microLabel, textAlign: 'center', marginBottom: 6 }}>Edit Guest Count</p>
                  <p style={{ color: text.primary, fontSize: 14, fontWeight: 600, textAlign: 'center', marginBottom: 20, ...FONT_NUM }}>
                    {formatSlotTime(editSlot.start)} – {formatSlotTime(editSlot.end)}
                  </p>
                  <div style={{ background: surface.control, border: `1px solid ${border.default}`, borderRadius: radius.md, padding: '16px', textAlign: 'center', marginBottom: 16 }}>
                    <span style={{ color: text.primary, fontSize: 48, fontWeight: 700, ...FONT_NUM }}>
                      {editValue || '0'}
                    </span>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <NumericKeypad
                      onDigit={(k) => setEditValue((v) => { const n = v + k; return parseInt(n, 10) > 9999 ? v : n; })}
                      onDelete={() => setEditValue((v) => v.slice(0, -1))}
                      onClear={() => setEditValue('')}
                      buttonHeight={52}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => { setEditSlot(null); setEditValue(''); }}
                      style={{ ...controlButton, background: 'transparent', flex: 1, minHeight: 52, padding: '13px 0', fontSize: 14, fontWeight: 600 }}
                      className="transition-colors touch-manipulation">Cancel</button>
                    <button onClick={async () => {
                        // Keep the modal open and show an error if the save fails
                        const ok = await saveSlotOverride(editSlot, parseInt(editValue, 10) || 0);
                        if (ok) { setEditSlot(null); setEditValue(''); }
                      }}
                      style={{ ...primaryButton('control'), flex: 1, minHeight: 52, padding: '13px 0', fontSize: 14, fontWeight: 700 }}
                      className="active:bg-[#1D4ED8] transition-colors touch-manipulation">Save</button>
                  </div>
                </div>
              </div>
            );

            // ── Layouts ──
            if (wide) {
              // Tablet / desktop: the parent container is the 2-column grid
              // (overflow hidden) — these two columns are its direct children.
              // Page scroll is impossible by construction; the only scrollable
              // element is the throughput slot list inside its card.
              // LEFT: hero + Dispatch (absorbs spare height).
              // RIGHT: Queue Time (fixed) + Hourly Throughput (internal scroll).
              return (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, gap: 12 }}>
                    {heroBlock}
                    <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ ...gatedStyle, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }} aria-hidden={panelLocked || undefined}>
                        {dispatchSection}
                      </div>
                      {panelLocked && lockOverlay}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, gap: 12 }}>
                    <div style={{ ...gatedStyle, flexShrink: 0 }} aria-hidden={panelLocked || undefined}>
                      {queueSection}
                    </div>
                    {throughputSection}
                  </div>
                  {editModal}
                </>
              );
            }

            // Phones: existing single-column layout
            return (
              <>
                {heroBlock}
                {/* ── Operator-gated panel: Dispatch + Queue Time ── */}
                <div style={{ position: 'relative' }}>
                  <div style={gatedStyle} aria-hidden={panelLocked || undefined}>
                    {dispatchSection}
                    {queueSection}
                  </div>
                  {panelLocked && lockOverlay}
                </div>
                {throughputSection}
                {editModal}
              </>
            );
        })()}
      </div>

      {/* ── Group Size Pad ── */}
      {groupSizePadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4">
          <div style={{ ...card(), width: '100%', maxWidth: 320, padding: 28 }}>
            <p style={{ ...microLabel, textAlign: 'center', marginBottom: 12 }}>Group Size</p>
            <div style={{ background: surface.control, border: `1px solid ${border.default}`, borderRadius: radius.md, padding: '16px', textAlign: 'center', marginBottom: 16 }}>
              <span style={{ color: text.primary, fontSize: 48, fontWeight: 700, ...FONT_NUM }}>
                {groupSizePadInput || '0'}
              </span>
            </div>
            <div style={{ marginBottom: 12 }}>
              <NumericKeypad
                onDigit={(k) => setGroupSizePadInput((v) => { const n = v + k; return parseInt(n, 10) > 30 ? v : n; })}
                onDelete={() => setGroupSizePadInput((v) => v.slice(0, -1))}
                onClear={() => setGroupSizePadInput('')}
                buttonHeight={52}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setGroupSizePadOpen(false); setGroupSizePadInput(''); }}
                style={{ ...controlButton, background: 'transparent', flex: 1, minHeight: 52, padding: '13px 0', fontSize: 14, fontWeight: 600 }}
                className="transition-colors touch-manipulation">Cancel</button>
              <button onClick={() => {
                  const val = Math.min(30, Math.max(0, parseInt(groupSizePadInput, 10) || 0));
                  setDispatchGroupSize(val);
                  setGroupSizePadOpen(false);
                  setGroupSizePadInput('');
                }}
                style={{ ...primaryButton('control'), flex: 1, minHeight: 52, padding: '13px 0', fontSize: 14, fontWeight: 700 }}
                className="active:bg-[#1D4ED8] transition-colors touch-manipulation">Set</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Field Notes Drawer ── */}
      {notesOpen && selected && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.85)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setNotesOpen(false); }}
        >
          <div
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: '85%', background: surface.card,
              borderTop: `1px solid ${border.default}`,
              borderRadius: '16px 16px 0 0',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Drawer header */}
            <div style={{ flexShrink: 0, padding: '16px 20px', borderBottom: `1px solid ${border.default}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: 0, color: text.primary, fontSize: 16, fontWeight: 700 }}>Show Report — {selected.name}</p>
                <p style={{ margin: 0, fontSize: 11, marginTop: 2, color: notesSaving === 'error' ? '#F87171' : notesSaving === 'saved' ? '#4ADE80' : text.secondary }}>
                  {notesSaving === 'saving' ? 'Saving...' :
                   notesSaving === 'saved' && notesLastSaved ? `✓ Draft saved ${new Date(notesLastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` :
                   notesSaving === 'error' ? 'Save failed — check connection' :
                   'Auto-saves every 2 seconds'}
                </p>
              </div>
              <button
                onClick={() => setNotesOpen(false)}
                style={{ background: 'none', border: 'none', color: text.secondary, fontSize: 22, cursor: 'pointer', padding: '4px 8px', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
            {/* Drawer body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ margin: 0, color: text.secondary, fontSize: 12 }}>Notes auto-save every 2 seconds. Submit final report via Sign-Off.</p>
              {([
                { key: 'operational_report', label: 'Operational' },
                { key: 'technical_report', label: 'Technical' },
                { key: 'costume_report', label: 'Costume' },
                { key: 'construction_report', label: 'Construction' },
                { key: 'additional_notes', label: 'Additional Notes' },
              ] as { key: keyof typeof notesData; label: string }[]).map(({ key, label }) => (
                <div key={key}>
                  <label style={{ ...microLabel, display: 'block', color: text.secondary, fontSize: 11, marginBottom: 6 }}>{label}</label>
                  <textarea
                    value={notesData[key]}
                    onChange={(e) => handleNotesChange(key, e.target.value)}
                    rows={4}
                    placeholder={`${label} notes...`}
                    style={{
                      width: '100%', background: surface.control, border: `1px solid ${border.strong}`, borderRadius: radius.sm,
                      color: text.primary, fontSize: 14, padding: '10px 12px', resize: 'vertical',
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
        <footer style={{ flexShrink: 0, background: surface.card, borderTop: `1px solid ${border.default}`, padding: wide ? '12px 24px' : '20px 24px' }}>
          <div className="flex items-center justify-between">
            <div>
              <div style={{ ...microLabel, marginBottom: 4 }}>
                {selected.name} Tonight
              </div>
              <div style={{ color: '#4ADE80', fontSize: 24, fontWeight: 800, ...FONT_NUM }}>
                {guestsTonight.toLocaleString()}
                <span style={{ color: text.secondary, fontSize: 13, marginLeft: 6 }}>guests</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ ...microLabel, marginBottom: 4 }}>
                Park Total
              </div>
              <div style={{ color: text.primary, fontSize: 24, fontWeight: 800, ...FONT_NUM }}>
                {totalGuestsAllAttractions.toLocaleString()}
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* ── Operator PIN — take over the panel ── */}
      {lockPinOpen && selected && (
        <PinPad
          app="control"
          title="Enter PIN to operate"
          subtitle={selected.name}
          verify={async (pin) => {
            const ok = await operatorLogin(pin);
            if (ok) {
              setLockPinOpen(false);
              pushToast('success', 'You are now operating ' + selected.name);
            }
            return ok;
          }}
          onCancel={() => setLockPinOpen(false)}
        />
      )}

      <ToastStack toasts={toasts} />
    </div>
  );
}
