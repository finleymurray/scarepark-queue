'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Attraction, AttractionStatus } from '@/types/database';

const STATUS_OPTIONS: AttractionStatus[] = ['OPEN', 'CLOSED', 'DELAYED', 'AT CAPACITY'];

const STATUS_COLORS: Record<AttractionStatus, string> = {
  'OPEN': 'bg-green-600',
  'CLOSED': 'bg-blood-bright',
  'DELAYED': 'bg-delay-orange',
  'AT CAPACITY': 'bg-capacity-amber',
};

const STATUS_TEXT_COLORS: Record<AttractionStatus, string> = {
  'OPEN': 'text-green-400',
  'CLOSED': 'text-blood-bright',
  'DELAYED': 'text-delay-orange',
  'AT CAPACITY': 'text-capacity-amber',
};

function ConfirmModal({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
      <div className="horror-card rounded-xl p-8 max-w-md w-full text-center space-y-6">
        <div className="text-blood-bright text-5xl mb-2" style={{ fontFamily: 'var(--font-horror)' }}>
          ⚠
        </div>
        <h2 className="text-bone text-xl font-bold">Close the Entire Park?</h2>
        <p className="text-bone/60 text-sm">
          This will set ALL attractions to <strong className="text-blood-bright">CLOSED</strong> immediately.
          This action is visible to the public displays instantly.
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-gore border border-blood/30 text-bone rounded-lg
                       hover:bg-flesh transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-3 bg-blood-bright hover:bg-blood-glow text-white rounded-lg
                       transition-colors font-bold"
          >
            Yes, Close All
          </button>
        </div>
      </div>
    </div>
  );
}

function SaveFeedback({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div className="absolute top-2 right-2 animate-save-feedback">
      <div className="bg-success/20 border border-success/40 text-success text-xs font-medium px-2 py-1 rounded-md flex items-center gap-1">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Saved
      </div>
    </div>
  );
}

function AttractionControl({
  attraction,
  onUpdate,
}: {
  attraction: Attraction;
  onUpdate: (id: string, updates: Partial<Attraction>) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [customTime, setCustomTime] = useState('');

  const status = attraction.status as AttractionStatus;

  async function handleUpdate(updates: Partial<Attraction>) {
    setSaving(true);
    await onUpdate(attraction.id, updates);
    setSaving(false);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 1500);
  }

  function handleTimeAdjust(delta: number) {
    const newTime = Math.max(0, Math.min(180, attraction.wait_time + delta));
    handleUpdate({ wait_time: newTime });
  }

  function handleSetTime() {
    const t = parseInt(customTime, 10);
    if (!isNaN(t) && t >= 0 && t <= 180) {
      handleUpdate({ wait_time: t });
      setCustomTime('');
    }
  }

  return (
    <div className="horror-card rounded-xl p-4 relative">
      <SaveFeedback show={showSaved} />

      {/* Header: Name + Status Badge */}
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-bone text-lg truncate mr-2"
          style={{ fontFamily: 'var(--font-horror)' }}
        >
          {attraction.name}
        </h3>
        <span className={`${STATUS_COLORS[status]} text-white text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap`}>
          {status}
        </span>
      </div>

      {/* Status Dropdown */}
      <div className="mb-4">
        <label className="block text-bone/50 text-xs font-medium mb-1">Status</label>
        <select
          value={status}
          onChange={(e) => handleUpdate({ status: e.target.value as AttractionStatus })}
          disabled={saving}
          className="w-full px-3 py-2 bg-black/60 border border-gore rounded-lg text-bone text-sm
                     focus:outline-none focus:border-blood-bright transition-colors cursor-pointer
                     disabled:opacity-50"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Current Wait Time */}
      <div className="text-center mb-3">
        <span className="text-bone/50 text-xs font-medium uppercase tracking-wider">Wait Time</span>
        <div className={`text-4xl font-bold tabular-nums mt-1 ${STATUS_TEXT_COLORS[status]}`}>
          {attraction.wait_time}
          <span className="text-base text-bone/40 ml-1">min</span>
        </div>
      </div>

      {/* Quick Adjust Buttons */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <button
          onClick={() => handleTimeAdjust(-5)}
          disabled={saving || attraction.wait_time <= 0}
          className="btn-quick px-2 py-2.5 bg-gore border border-blood/30 text-bone rounded-lg
                     hover:bg-flesh text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed"
        >
          -5m
        </button>
        <button
          onClick={() => handleTimeAdjust(5)}
          disabled={saving}
          className="btn-quick px-2 py-2.5 bg-gore border border-blood/30 text-bone rounded-lg
                     hover:bg-flesh text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed"
        >
          +5m
        </button>
        <button
          onClick={() => handleTimeAdjust(10)}
          disabled={saving}
          className="btn-quick px-2 py-2.5 bg-gore border border-blood/30 text-bone rounded-lg
                     hover:bg-flesh text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed"
        >
          +10m
        </button>
      </div>

      {/* Set Exact Time */}
      <div className="flex gap-2">
        <input
          type="number"
          value={customTime}
          onChange={(e) => setCustomTime(e.target.value)}
          placeholder="Set min"
          min={0}
          max={180}
          className="flex-1 px-3 py-2 bg-black/60 border border-gore rounded-lg text-bone text-sm
                     placeholder-bone/30 focus:outline-none focus:border-blood-bright transition-colors
                     [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none
                     [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          onClick={handleSetTime}
          disabled={saving || !customTime}
          className="btn-quick px-4 py-2 bg-blood hover:bg-blood-bright text-bone text-sm font-semibold
                     rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Set
        </button>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCloseAll, setShowCloseAll] = useState(false);
  const [closingAll, setClosingAll] = useState(false);

  useEffect(() => {
    async function init() {
      // Check auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/admin/login');
        return;
      }

      // Fetch attractions
      const { data, error } = await supabase
        .from('attractions')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Error fetching attractions:', error);
        return;
      }

      setAttractions(data || []);
      setLoading(false);

      // Realtime subscription so multiple staff see the same state
      const channel = supabase
        .channel('admin-dashboard')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'attractions' },
          (payload) => {
            setAttractions((prev) =>
              prev.map((a) =>
                a.id === (payload.new as Attraction).id
                  ? (payload.new as Attraction)
                  : a
              )
            );
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    init();
  }, [router]);

  const handleUpdate = useCallback(async (id: string, updates: Partial<Attraction>) => {
    const { error } = await supabase
      .from('attractions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error updating attraction:', error);
    }
  }, []);

  async function handleCloseAll() {
    setClosingAll(true);
    setShowCloseAll(false);

    // Update all attractions to CLOSED
    const updatePromises = attractions.map((a) =>
      supabase
        .from('attractions')
        .update({ status: 'CLOSED', updated_at: new Date().toISOString() })
        .eq('id', a.id)
    );

    await Promise.all(updatePromises);
    setClosingAll(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/admin/login');
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="text-center">
          <h1 className="text-blood-bright text-3xl animate-flicker mb-4"
              style={{ fontFamily: 'var(--font-horror)' }}>
            Loading Dashboard...
          </h1>
          <div className="w-16 h-1 bg-blood mx-auto rounded-full animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 sm:p-6">
      <ConfirmModal
        open={showCloseAll}
        onConfirm={handleCloseAll}
        onCancel={() => setShowCloseAll(false)}
      />

      {/* Top Bar */}
      <header className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-blood-bright text-3xl sm:text-4xl"
            style={{ fontFamily: 'var(--font-horror)' }}
          >
            Control Room
          </h1>
          <p className="text-bone/40 text-sm mt-1">Scarepark Queue Management</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Close All Button */}
          <button
            onClick={() => setShowCloseAll(true)}
            disabled={closingAll}
            className="px-5 py-2.5 bg-blood-bright hover:bg-blood-glow text-white font-bold rounded-lg
                       transition-all duration-200 disabled:opacity-50 text-sm sm:text-base
                       shadow-[0_0_15px_rgba(204,0,0,0.4)] hover:shadow-[0_0_25px_rgba(204,0,0,0.6)]"
          >
            {closingAll ? 'Closing...' : '🚨 CLOSE ALL'}
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="px-4 py-2.5 bg-gore border border-blood/30 text-bone/60 hover:text-bone
                       rounded-lg transition-colors text-sm"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="mx-auto w-full h-px bg-gradient-to-r from-transparent via-blood/50 to-transparent mb-6" />

      {/* Dashboard Grid — all 5 attractions visible at once */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {attractions.map((attraction) => (
          <AttractionControl
            key={attraction.id}
            attraction={attraction}
            onUpdate={handleUpdate}
          />
        ))}
      </div>
    </div>
  );
}
