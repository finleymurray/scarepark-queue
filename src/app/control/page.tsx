'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { checkAuth } from '@/lib/auth';
import type { Attraction, ParkSetting, ThroughputLog } from '@/types/database';

/* ── Helpers ── */

function generateHourlySlots(openTime: string, closeTime: string): { start: string; end: string }[] {
  if (!openTime || !closeTime) return [];
  const [oh, om] = openTime.split(':').map(Number);
  const [ch, cm] = closeTime.split(':').map(Number);

  let startMinutes = oh * 60 + (om || 0);
  let endMinutes = ch * 60 + (cm || 0);

  // Handle crossing midnight (e.g., 18:00 - 01:00)
  if (endMinutes <= startMinutes) endMinutes += 24 * 60;

  const slots: { start: string; end: string }[] = [];
  let cursor = startMinutes;
  while (cursor < endMinutes) {
    const next = Math.min(cursor + 60, endMinutes);
    const sh = Math.floor(cursor / 60) % 24;
    const sm = cursor % 60;
    const eh = Math.floor(next / 60) % 24;
    const em = next % 60;
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
    let startMin = sh * 60 + sm;
    let endMin = eh * 60 + em;
    if (endMin <= startMin) endMin += 24 * 60;
    let checkNow = nowMinutes;
    if (checkNow < startMin && startMin > 12 * 60) checkNow += 24 * 60;
    if (checkNow >= startMin && checkNow < endMin) return i;
  }
  return -1;
}

function formatSlotTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function getTodayDateStr(): string {
  return new Date().toISOString().split('T')[0];
}

/* ── Numeric Keypad Modal ── */
function NumericKeypad({
  open,
  currentValue,
  slotLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  currentValue: number;
  slotLabel: string;
  onConfirm: (value: number) => void;
  onCancel: () => void;
}) {
  const [display, setDisplay] = useState('');

  useEffect(() => {
    if (open) setDisplay(currentValue > 0 ? String(currentValue) : '');
  }, [open, currentValue]);

  if (!open) return null;

  function handleKey(key: string) {
    if (key === 'clear') {
      setDisplay('');
    } else if (key === 'back') {
      setDisplay((prev) => prev.slice(0, -1));
    } else {
      setDisplay((prev) => {
        const next = prev + key;
        if (parseInt(next, 10) > 99999) return prev;
        return next;
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4">
      <div className="w-full max-w-sm rounded-lg bg-[#111] border border-[#333] p-6 space-y-4">
        <div className="text-center">
          <p className="text-white/50 text-xs uppercase tracking-wider font-medium">{slotLabel}</p>
          <p className="text-white text-sm mt-1">Enter guest count</p>
        </div>

        {/* Display */}
        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-5 text-center">
          <span className="text-white text-5xl font-bold tabular-nums">
            {display || '0'}
          </span>
        </div>

        {/* Keys */}
        <div className="grid grid-cols-3 gap-2">
          {['1','2','3','4','5','6','7','8','9'].map((k) => (
            <button
              key={k}
              onClick={() => handleKey(k)}
              className="py-4 text-2xl font-bold text-white bg-[#1a1a1a] rounded-md
                         active:bg-[#222] transition-colors touch-manipulation"
            >
              {k}
            </button>
          ))}
          <button
            onClick={() => handleKey('clear')}
            className="py-4 text-lg font-bold text-red-400 bg-[#1a1a1a] rounded-md
                       active:bg-red-900/30 transition-colors touch-manipulation"
          >
            CLR
          </button>
          <button
            onClick={() => handleKey('0')}
            className="py-4 text-2xl font-bold text-white bg-[#1a1a1a] rounded-md
                       active:bg-[#222] transition-colors touch-manipulation"
          >
            0
          </button>
          <button
            onClick={() => handleKey('back')}
            className="py-4 text-lg font-bold text-yellow-400 bg-[#1a1a1a] rounded-md
                       active:bg-yellow-900/30 transition-colors touch-manipulation"
          >
            DEL
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-4 text-lg font-bold text-white/60 bg-[#111] rounded-md
                       active:bg-[#222] transition-colors touch-manipulation"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(parseInt(display, 10) || 0)}
            className="flex-1 py-4 text-lg font-bold text-black bg-white rounded-md
                       active:bg-white/80 transition-colors touch-manipulation"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Supervisor Dashboard ── */
export default function SupervisorDashboard() {
  const router = useRouter();
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [openingTime, setOpeningTime] = useState('');
  const [closingTime, setClosingTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [throughputLogs, setThroughputLogs] = useState<ThroughputLog[]>([]);
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [keypadSlot, setKeypadSlot] = useState<{ start: string; end: string } | null>(null);
  const [keypadValue, setKeypadValue] = useState(0);
  const [customWait, setCustomWait] = useState('');
  const [now, setNow] = useState(Date.now());
  const [userEmail, setUserEmail] = useState('');
  const tabBarRef = useRef<HTMLDivElement>(null);

  // Tick every 30s to keep current slot highlighting fresh
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  // Auth & initial data fetch
  useEffect(() => {
    async function init() {
      const auth = await checkAuth();
      if (!auth.authenticated || !auth.role) {
        router.push('/login');
        return;
      }
      // Store email for display
      setUserEmail(auth.email || '');

      const [attractionsRes, settingsRes] = await Promise.all([
        supabase.from('attractions').select('*').order('sort_order', { ascending: true }),
        supabase.from('park_settings').select('*'),
      ]);

      if (!attractionsRes.error && attractionsRes.data) {
        if (auth.role === 'supervisor' && auth.allowedAttractions) {
          const allowed = new Set(auth.allowedAttractions);
          const filtered = attractionsRes.data.filter((a: Attraction) => allowed.has(a.id));
          setAttractions(filtered);
        } else {
          setAttractions(attractionsRes.data);
        }
        const firstRide = attractionsRes.data.find((a: Attraction) => a.attraction_type !== 'show');
        if (firstRide) {
          setSelectedId(firstRide.id);
        }
      }

      if (settingsRes.data) {
        for (const s of settingsRes.data) {
          if (s.key === 'opening_time') setOpeningTime(s.value);
          if (s.key === 'closing_time') setClosingTime(s.value);
        }
      }

      setLoading(false);

      // Realtime: attractions
      const attractionsChannel = supabase
        .channel('control-attractions')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'attractions' },
          (payload) => {
            if (payload.eventType === 'UPDATE') {
              setAttractions((prev) =>
                prev.map((a) =>
                  a.id === (payload.new as Attraction).id ? (payload.new as Attraction) : a
                )
              );
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

      // Realtime: settings
      const settingsChannel = supabase
        .channel('control-settings')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'park_settings' },
          (payload) => {
            const setting = payload.new as ParkSetting;
            if (setting.key === 'opening_time') setOpeningTime(setting.value);
            if (setting.key === 'closing_time') setClosingTime(setting.value);
          }
        )
        .subscribe();

      // Realtime: throughput_logs
      const logsChannel = supabase
        .channel('control-logs')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'throughput_logs' },
          () => {
            // Refetch logs when anything changes
            fetchThroughputLogs();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(attractionsChannel);
        supabase.removeChannel(settingsChannel);
        supabase.removeChannel(logsChannel);
      };
    }

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Fetch throughput logs for today
  const fetchThroughputLogs = useCallback(async () => {
    const today = getTodayDateStr();

    const { data, error } = await supabase
      .from('throughput_logs')
      .select('*')
      .eq('log_date', today);

    if (!error && data) {
      setThroughputLogs(data);
    }
  }, []);

  useEffect(() => {
    if (!loading) fetchThroughputLogs();
  }, [loading, fetchThroughputLogs]);

  // Only rides (not shows) for supervisor dashboard
  const rides = attractions.filter((a) => a.attraction_type !== 'show');

  // Auto-select first ride if current selection is invalid
  useEffect(() => {
    if (rides.length > 0 && (!selectedId || !rides.find((r) => r.id === selectedId))) {
      setSelectedId(rides[0].id);
    }
  }, [rides, selectedId]);

  // Selected attraction
  const selected = rides.find((a) => a.id === selectedId) || null;

  // Hourly slots
  const slots = generateHourlySlots(openingTime, closingTime);
  const currentSlotIdx = getCurrentSlotIndex(slots);

  // Throughput for selected attraction (already filtered to today by fetch)
  function getLogForSlot(slot: { start: string; end: string }): ThroughputLog | undefined {
    if (!selectedId) return undefined;
    return throughputLogs.find(
      (l) => l.attraction_id === selectedId && l.slot_start === slot.start && l.slot_end === slot.end
    );
  }

  // Total guests tonight for selected attraction
  const guestsTonight = throughputLogs
    .filter((l) => selectedId && l.attraction_id === selectedId)
    .reduce((sum, l) => sum + l.guest_count, 0);

  // Total guests across ALL attractions tonight
  const totalGuestsAllAttractions = throughputLogs
    .reduce((sum, l) => sum + l.guest_count, 0);

  // Handle queue time update
  async function handleWaitTimeUpdate(delta: number) {
    if (!selected) return;
    const newTime = Math.max(0, Math.min(180, selected.wait_time + delta));
    await supabase
      .from('attractions')
      .update({ wait_time: newTime, updated_at: new Date().toISOString() })
      .eq('id', selected.id);
  }

  async function handleSetCustomWait() {
    if (!selected || !customWait) return;
    const t = parseInt(customWait, 10);
    if (isNaN(t) || t < 0 || t > 180) return;
    await supabase
      .from('attractions')
      .update({ wait_time: t, updated_at: new Date().toISOString() })
      .eq('id', selected.id);
    setCustomWait('');
  }

  // Handle throughput log save
  async function handleLogThroughput(slot: { start: string; end: string }, count: number) {
    if (!selectedId) return;
    const existing = getLogForSlot(slot);

    if (existing) {
      await supabase
        .from('throughput_logs')
        .update({ guest_count: count, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('throughput_logs')
        .insert({
          attraction_id: selectedId,
          slot_start: slot.start,
          slot_end: slot.end,
          guest_count: count,
          logged_by: 'supervisor',
          log_date: getTodayDateStr(),
        });
    }

    await fetchThroughputLogs();
  }

  function openKeypadForSlot(slot: { start: string; end: string }) {
    const existing = getLogForSlot(slot);
    setKeypadSlot(slot);
    setKeypadValue(existing?.guest_count || 0);
    setKeypadOpen(true);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
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
      <div className="flex h-screen items-center justify-center bg-black px-6">
        <div className="text-center">
          <p className="text-white/60 text-lg mb-4">No rides configured.</p>
          <p className="text-white/30 text-sm">Ask a manager to add rides in the Admin panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-black text-white overflow-hidden">
      {/* Numeric Keypad Modal */}
      <NumericKeypad
        open={keypadOpen}
        currentValue={keypadValue}
        slotLabel={keypadSlot ? `${formatSlotTime(keypadSlot.start)} - ${formatSlotTime(keypadSlot.end)}` : ''}
        onConfirm={(value) => {
          if (keypadSlot) handleLogThroughput(keypadSlot, value);
          setKeypadOpen(false);
        }}
        onCancel={() => setKeypadOpen(false)}
      />

      {/* Header — matches people.immersivecore.network */}
      <div style={{ background: '#111', borderBottom: '1px solid #333', padding: '12px 0', flexShrink: 0 }}>
        <div style={{ padding: '0 20px', display: 'flex', alignItems: 'center' }}>
          <a href="/control" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <Image src="/logo.png" alt="Immersive Core" width={100} height={30} priority />
            <h1 style={{ color: '#fff', fontSize: 18, fontWeight: 600, margin: 0 }}>Field Control</h1>
          </a>
        </div>
      </div>

      {/* Nav / Attraction Tab Bar — matches people.immersivecore.network */}
      <div style={{ background: '#111', borderBottom: '1px solid #333', padding: '8px 0', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        <div
          ref={tabBarRef}
          className="scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ display: 'flex', gap: 4, padding: '0 20px', overflowX: 'auto', flex: 1 }}
        >
          {rides.map((a) => {
            const isSelected = a.id === selectedId;
            return (
              <button
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                style={{
                  flexShrink: 0,
                  color: isSelected ? '#fff' : '#aaa',
                  fontSize: 14,
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: isSelected ? '#222' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.2s, color 0.2s',
                  touchAction: 'manipulation',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = '#222';
                    e.currentTarget.style.color = '#fff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#aaa';
                  }
                }}
              >
                {a.name}
              </button>
            );
          })}
        </div>

        {/* User info — pushed right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', flexShrink: 0, fontSize: 13, color: '#aaa' }}>
          {userEmail && <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</span>}
          <button
            onClick={handleLogout}
            style={{
              background: 'none',
              border: '1px solid #555',
              color: '#aaa',
              padding: '4px 10px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#888';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#555';
              e.currentTarget.style.color = '#aaa';
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Main Content — Scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {selected && (
          <>
            {/* ── Queue Time Control ── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-white" />
                <h2 className="text-white/60 text-xs uppercase tracking-wider font-semibold">Queue Time</h2>
              </div>

              <div className="bg-[#111] border border-[#333] rounded-lg p-5">
                {/* Current wait display */}
                <div className="text-center mb-5">
                  <div className={`text-6xl font-black tabular-nums ${
                    selected.status === 'OPEN' ? 'text-[#22C55E]' :
                    selected.status === 'CLOSED' ? 'text-[#dc3545]' :
                    selected.status === 'DELAYED' ? 'text-[#f0ad4e]' :
                    'text-[#F59E0B]'
                  }`}>
                    {selected.attraction_type === 'show' ? (
                      <span className="text-3xl">{selected.status}</span>
                    ) : (
                      <>
                        {selected.wait_time}
                        <span className="text-2xl text-white/30 ml-1">min</span>
                      </>
                    )}
                  </div>
                  <p className={`text-xs mt-1 font-medium uppercase tracking-wider ${
                    selected.status === 'OPEN' ? 'text-[#22C55E]/50' :
                    selected.status === 'CLOSED' ? 'text-[#dc3545]/50' :
                    'text-[#f0ad4e]/50'
                  }`}>
                    {selected.status}
                  </p>
                </div>

                {/* +/- Buttons (only for rides) */}
                {selected.attraction_type !== 'show' && (
                  <>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <button
                        onClick={() => handleWaitTimeUpdate(-5)}
                        disabled={selected.wait_time <= 0}
                        className="py-5 text-2xl font-black bg-[#1a1a1a] rounded-md text-red-400
                                   active:bg-red-900/20 transition-colors touch-manipulation
                                   disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        -5
                      </button>
                      <button
                        onClick={() => handleWaitTimeUpdate(5)}
                        className="py-5 text-2xl font-black bg-[#1a1a1a] rounded-md text-[#22C55E]
                                   active:bg-green-900/20 transition-colors touch-manipulation"
                      >
                        +5
                      </button>
                    </div>

                    {/* Custom input */}
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={customWait}
                        onChange={(e) => setCustomWait(e.target.value)}
                        placeholder="Custom minutes"
                        min={0}
                        max={180}
                        className="flex-1 px-4 py-4 bg-[#1a1a1a] border border-[#444] rounded-md text-white text-lg
                                   placeholder-white/20 focus:outline-none focus:border-[#6ea8fe] focus:shadow-[0_0_0_2px_rgba(110,168,254,0.2)] transition-colors
                                   [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none
                                   [&::-webkit-outer-spin-button]:appearance-none touch-manipulation"
                      />
                      <button
                        onClick={handleSetCustomWait}
                        disabled={!customWait}
                        className="px-6 py-4 bg-white text-black font-bold text-lg rounded-md
                                   active:bg-white/80 transition-colors touch-manipulation
                                   disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        Set
                      </button>
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* ── Hourly Throughput Grid ── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-white" />
                <h2 className="text-white/60 text-xs uppercase tracking-wider font-semibold">Hourly Throughput</h2>
              </div>

              {slots.length === 0 ? (
                <div className="bg-[#111] border border-[#333] rounded-lg p-6 text-center">
                  <p className="text-white/30 text-sm">Operating hours not set.</p>
                  <p className="text-white/20 text-xs mt-1">Ask a manager to set hours in Admin.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {slots.map((slot, idx) => {
                    const isCurrent = idx === currentSlotIdx;
                    const isPast = idx < currentSlotIdx || currentSlotIdx === -1;
                    const isFuture = idx > currentSlotIdx && currentSlotIdx !== -1;
                    const log = getLogForSlot(slot);
                    const guestCount = log?.guest_count ?? null;

                    return (
                      <button
                        key={`${slot.start}-${slot.end}`}
                        onClick={() => {
                          if (isCurrent || isPast) openKeypadForSlot(slot);
                        }}
                        disabled={isFuture}
                        className={`w-full flex items-center justify-between px-5 py-4 rounded-md transition-all touch-manipulation
                          ${isCurrent
                            ? 'bg-[#22C55E]/10 border-2 border-[#22C55E]'
                            : isPast
                              ? 'bg-[#1a1a1a] border border-[#333] active:bg-[#222]'
                              : 'bg-[#1a1a1a] border border-[#222] opacity-40 cursor-not-allowed'
                          }`}
                      >
                        <div className="text-left">
                          <div className={`text-sm font-bold ${isCurrent ? 'text-[#22C55E]' : 'text-white/70'}`}>
                            {formatSlotTime(slot.start)} - {formatSlotTime(slot.end)}
                          </div>
                          {isCurrent && (
                            <div className="text-[#22C55E]/60 text-xs font-medium mt-0.5">CURRENT HOUR</div>
                          )}
                        </div>

                        <div className="text-right">
                          {guestCount !== null ? (
                            <div className={`text-2xl font-black tabular-nums ${isCurrent ? 'text-[#22C55E]' : 'text-white'}`}>
                              {guestCount}
                            </div>
                          ) : (
                            <div className={`text-lg ${isCurrent ? 'text-[#22C55E]/40' : 'text-white/20'}`}>
                              {isFuture ? '—' : 'Tap to log'}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* ── Footer: Guests Tonight ── */}
      <footer className="flex-shrink-0 border-t border-[#333] bg-[#111] px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-white/40 text-xs uppercase tracking-wider font-medium">
              {selected?.name || 'All'} Tonight
            </div>
            <div className="text-[#22C55E] text-2xl font-black tabular-nums">
              {guestsTonight.toLocaleString()}
              <span className="text-white/30 text-sm ml-1">guests</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-white/40 text-xs uppercase tracking-wider font-medium">Park Total</div>
            <div className="text-white text-2xl font-black tabular-nums">
              {totalGuestsAllAttractions.toLocaleString()}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
