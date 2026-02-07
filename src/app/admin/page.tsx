'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Attraction, AttractionStatus, ParkSetting } from '@/types/database';

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

/* ── Confirm Modal ── */
function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
      <div className="horror-card rounded-xl p-8 max-w-md w-full text-center space-y-6">
        <div className="text-blood-bright text-5xl mb-2">⚠</div>
        <h2 className="text-bone text-xl font-bold">{title}</h2>
        <p className="text-bone/60 text-sm">{message}</p>
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
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Save Feedback ── */
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

/* ── Add Attraction Form ── */
function AddAttractionForm({ onAdd }: { onAdd: (name: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    if (!name.trim()) return;
    setAdding(true);
    await onAdd(name.trim());
    setName('');
    setAdding(false);
  }

  return (
    <div className="horror-card rounded-xl p-4">
      <h3 className="text-bone text-lg font-bold mb-3">Add Attraction</h3>
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          placeholder="Attraction name"
          className="flex-1 px-3 py-2 bg-black/60 border border-gore rounded-lg text-bone text-sm
                     placeholder-bone/30 focus:outline-none focus:border-blood-bright transition-colors"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !name.trim()}
          className="btn-quick px-4 py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-semibold
                     rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {adding ? '...' : 'Add'}
        </button>
      </div>
    </div>
  );
}

/* ── Closing Time Control ── */
function ClosingTimeControl({
  closingTime,
  onUpdate,
}: {
  closingTime: string;
  onUpdate: (value: string) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [timeValue, setTimeValue] = useState(closingTime);

  useEffect(() => {
    setTimeValue(closingTime);
  }, [closingTime]);

  async function handleSave() {
    setSaving(true);
    await onUpdate(timeValue);
    setSaving(false);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 1500);
  }

  return (
    <div className="closing-card rounded-xl p-4 relative">
      <SaveFeedback show={showSaved} />

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-closing-light text-lg font-bold">Park Closing Time</h3>
        <span className="bg-closing text-white text-xs font-bold px-2.5 py-1 rounded-full">INFO</span>
      </div>

      <div className="text-center mb-3">
        <span className="text-closing-light/50 text-xs font-medium uppercase tracking-wider">Current Time</span>
        <div className="text-4xl font-bold tabular-nums mt-1 text-closing-light">
          {closingTime || '--:--'}
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="time"
          value={timeValue}
          onChange={(e) => setTimeValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          className="flex-1 px-3 py-2 bg-black/60 border border-[#2a2a5a] rounded-lg text-bone text-sm
                     focus:outline-none focus:border-closing transition-colors"
        />
        <button
          onClick={handleSave}
          disabled={saving || timeValue === closingTime}
          className="btn-quick px-4 py-2 bg-closing hover:bg-closing-light text-white text-sm font-semibold
                     rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Set
        </button>
      </div>
    </div>
  );
}

/* ── Attraction Control Card ── */
function AttractionControl({
  attraction,
  onUpdate,
  onDelete,
}: {
  attraction: Attraction;
  onUpdate: (id: string, updates: Partial<Attraction>) => Promise<void>;
  onDelete: (id: string, name: string) => void;
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

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-bone text-lg font-bold truncate mr-2">
          {attraction.name}
        </h3>
        <span className={`${STATUS_COLORS[status]} text-white text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap`}>
          {status}
        </span>
      </div>

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
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="text-center mb-3">
        <span className="text-bone/50 text-xs font-medium uppercase tracking-wider">Wait Time</span>
        <div className={`text-4xl font-bold tabular-nums mt-1 ${STATUS_TEXT_COLORS[status]}`}>
          {attraction.wait_time}
          <span className="text-base text-bone/40 ml-1">min</span>
        </div>
      </div>

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

      <div className="flex gap-2 mb-3">
        <input
          type="number"
          value={customTime}
          onChange={(e) => setCustomTime(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSetTime(); }}
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

      {/* Delete button */}
      <button
        onClick={() => onDelete(attraction.id, attraction.name)}
        className="w-full py-2 text-xs text-bone/30 hover:text-blood-bright hover:bg-blood/10
                   rounded-lg transition-colors"
      >
        Remove Attraction
      </button>
    </div>
  );
}

/* ── Main Dashboard ── */
export default function AdminDashboard() {
  const router = useRouter();
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [closingTime, setClosingTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCloseAll, setShowCloseAll] = useState(false);
  const [closingAll, setClosingAll] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/admin/login');
        return;
      }

      const [attractionsRes, settingsRes] = await Promise.all([
        supabase.from('attractions').select('*').order('sort_order', { ascending: true }),
        supabase.from('park_settings').select('*').eq('key', 'closing_time').single(),
      ]);

      if (!attractionsRes.error) {
        setAttractions(attractionsRes.data || []);
      }
      if (settingsRes.data) {
        setClosingTime(settingsRes.data.value);
      }
      setLoading(false);

      const attractionsChannel = supabase
        .channel('admin-attractions')
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

      const settingsChannel = supabase
        .channel('admin-settings')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'park_settings' },
          (payload) => {
            const setting = payload.new as ParkSetting;
            if (setting.key === 'closing_time') {
              setClosingTime(setting.value);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(attractionsChannel);
        supabase.removeChannel(settingsChannel);
      };
    }

    init();
  }, [router]);

  const handleUpdate = useCallback(async (id: string, updates: Partial<Attraction>) => {
    const { error } = await supabase
      .from('attractions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) console.error('Error updating attraction:', error);
  }, []);

  const handleClosingTimeUpdate = useCallback(async (value: string) => {
    const { error } = await supabase
      .from('park_settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', 'closing_time');

    if (error) console.error('Error updating closing time:', error);
  }, []);

  const handleAddAttraction = useCallback(async (name: string) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const nextOrder = attractions.length > 0
      ? Math.max(...attractions.map((a) => a.sort_order)) + 1
      : 1;

    const { error } = await supabase
      .from('attractions')
      .insert({
        name,
        slug,
        status: 'CLOSED',
        wait_time: 0,
        sort_order: nextOrder,
      });

    if (error) console.error('Error adding attraction:', error);
  }, [attractions]);

  const handleDeleteAttraction = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('attractions')
      .delete()
      .eq('id', id);

    if (error) console.error('Error deleting attraction:', error);
    setDeleteTarget(null);
  }, []);

  async function handleCloseAll() {
    setClosingAll(true);
    setShowCloseAll(false);

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
        <h1 className="text-blood-bright text-3xl font-bold">Loading Dashboard...</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 sm:p-6">
      {/* Close All Modal */}
      <ConfirmModal
        open={showCloseAll}
        title="Close the Entire Park?"
        message="This will set ALL attractions to CLOSED immediately. This action is visible to the public displays instantly."
        confirmLabel="Yes, Close All"
        onConfirm={handleCloseAll}
        onCancel={() => setShowCloseAll(false)}
      />

      {/* Delete Modal */}
      <ConfirmModal
        open={!!deleteTarget}
        title={`Remove "${deleteTarget?.name}"?`}
        message="This attraction will be permanently removed from the queue board. This takes effect immediately."
        confirmLabel="Yes, Remove"
        onConfirm={() => deleteTarget && handleDeleteAttraction(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <header className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-blood-bright text-3xl font-black uppercase tracking-wide sm:text-4xl">
            Control Room
          </h1>
          <p className="text-bone/40 text-sm mt-1">Scarepark Queue Management</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCloseAll(true)}
            disabled={closingAll}
            className="px-5 py-2.5 bg-blood-bright hover:bg-blood-glow text-white font-bold rounded-lg
                       transition-all duration-200 disabled:opacity-50 text-sm sm:text-base"
          >
            {closingAll ? 'Closing...' : 'CLOSE ALL'}
          </button>

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

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {attractions.map((attraction) => (
          <AttractionControl
            key={attraction.id}
            attraction={attraction}
            onUpdate={handleUpdate}
            onDelete={(id, name) => setDeleteTarget({ id, name })}
          />
        ))}
        <ClosingTimeControl
          closingTime={closingTime}
          onUpdate={handleClosingTimeUpdate}
        />
        <AddAttractionForm onAdd={handleAddAttraction} />
      </div>
    </div>
  );
}
