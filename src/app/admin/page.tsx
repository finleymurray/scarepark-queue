'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkAuth } from '@/lib/auth';
import AdminNav from '@/components/AdminNav';
import type { Attraction, AttractionStatus, AttractionType, ParkSetting } from '@/types/database';

const STATUS_OPTIONS: AttractionStatus[] = ['OPEN', 'CLOSED', 'DELAYED', 'AT CAPACITY'];
const SHOW_STATUS_OPTIONS: AttractionStatus[] = ['OPEN', 'DELAYED'];

const STATUS_COLORS: Record<AttractionStatus, string> = {
  'OPEN': 'bg-[#22C55E]',
  'CLOSED': 'bg-[#dc3545]',
  'DELAYED': 'bg-[#f0ad4e]',
  'AT CAPACITY': 'bg-[#F59E0B]',
};

const STATUS_TEXT_COLORS: Record<AttractionStatus, string> = {
  'OPEN': 'text-green-400',
  'CLOSED': 'text-[#dc3545]',
  'DELAYED': 'text-delay-orange',
  'AT CAPACITY': 'text-capacity-amber',
};

function formatTime12h(time: string): string {
  if (!time) return '--:--';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${m} ${ampm}`;
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div style={{ background: '#1a1a1a', border: '1px solid #444', borderRadius: 8, padding: 24, maxWidth: 448, width: '100%', textAlign: 'center' as const }} className="space-y-6">
        <div className="text-[#dc3545] text-5xl mb-2">⚠</div>
        <h2 className="text-white text-xl font-bold">{title}</h2>
        <p className="text-[#888] text-sm">{message}</p>
        <div className="flex gap-3 justify-center pt-2">
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-transparent border border-[#333] text-white hover:border-[#555]
                       rounded-md transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-3 bg-[#dc3545] hover:bg-[#c82333] text-white rounded-md
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
      <div className="bg-[#22C55E]/20 border border-[#22C55E]/40 text-[#22C55E] text-xs font-medium px-2 py-1 rounded-md flex items-center gap-1">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Saved
      </div>
    </div>
  );
}

/* ── Editable Name ── */
function EditableName({
  name,
  onSave,
}: {
  name: string;
  onSave: (newName: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(name);
  }, [name]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function commit() {
    const trimmed = value.trim();
    if (trimmed && trimmed !== name) {
      onSave(trimmed);
    } else {
      setValue(name);
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setValue(name); setEditing(false); }
        }}
        className="text-white text-lg font-bold bg-[#1a1a1a] border border-[#444] rounded-md px-2 py-0.5 mr-2
                   focus:outline-none focus:border-[#888] transition-colors min-w-0 flex-1"
      />
    );
  }

  return (
    <h3
      onClick={() => setEditing(true)}
      className="text-white text-lg font-bold truncate mr-2 cursor-pointer hover:text-white/70 transition-colors"
      title="Click to edit name"
    >
      {name}
      <svg className="w-3.5 h-3.5 inline-block ml-2 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    </h3>
  );
}

/* ── Add Attraction Form ── */
function AddAttractionForm({ onAdd }: { onAdd: (name: string, type: AttractionType) => Promise<void> }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AttractionType>('ride');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  async function handleAdd() {
    if (!name.trim()) return;
    setAdding(true);
    setError('');
    try {
      await onAdd(name.trim(), type);
      setName('');
      setType('ride');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add attraction');
    }
    setAdding(false);
  }

  return (
    <div style={{ background: '#111', border: '1px solid #333', borderRadius: 8, padding: 20 }}>
      <h3 className="text-white text-lg font-bold mb-3">Add Attraction</h3>

      {/* Type toggle */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setType('ride')}
          className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors border ${
            type === 'ride'
              ? 'bg-white text-black border-white'
              : 'bg-transparent text-[#888] border-[#333]'
          }`}
        >
          Ride
        </button>
        <button
          onClick={() => setType('show')}
          className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors border ${
            type === 'show'
              ? 'bg-white text-black border-white'
              : 'bg-transparent text-[#888] border-[#333]'
          }`}
        >
          Live Show
        </button>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          placeholder={type === 'ride' ? 'Ride name' : 'Show name'}
          className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-[#444] rounded-md text-white text-sm
                     placeholder-white/30 focus:outline-none focus:border-[#888] transition-colors"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !name.trim()}
          className="btn-quick px-4 py-2 bg-[#22C55E] hover:bg-[#16a34a] text-black text-sm font-semibold
                     rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {adding ? '...' : 'Add'}
        </button>
      </div>

      {error && (
        <p className="text-[#dc3545] text-xs mt-2">{error}</p>
      )}
    </div>
  );
}

/* ── Operating Hours Control ── */
function OperatingHoursControl({
  openingTime,
  closingTime,
  onUpdateOpening,
  onUpdateClosing,
}: {
  openingTime: string;
  closingTime: string;
  onUpdateOpening: (value: string) => Promise<void>;
  onUpdateClosing: (value: string) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [openValue, setOpenValue] = useState(openingTime);
  const [closeValue, setCloseValue] = useState(closingTime);

  useEffect(() => { setOpenValue(openingTime); }, [openingTime]);
  useEffect(() => { setCloseValue(closingTime); }, [closingTime]);

  async function handleSave() {
    setSaving(true);
    const promises: Promise<void>[] = [];
    if (openValue !== openingTime) promises.push(onUpdateOpening(openValue));
    if (closeValue !== closingTime) promises.push(onUpdateClosing(closeValue));
    await Promise.all(promises);
    setSaving(false);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 1500);
  }

  const hasChanges = openValue !== openingTime || closeValue !== closingTime;

  return (
    <div style={{ background: '#111', border: '1px solid #333', borderRadius: 8, padding: 20, position: 'relative' }}>
      <SaveFeedback show={showSaved} />

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white text-lg font-bold">Operating Hours</h3>
        <span className="bg-white text-black text-xs font-bold px-2.5 py-1 rounded-full">INFO</span>
      </div>

      <div className="flex gap-4 text-center mb-3">
        <div className="flex-1">
          <span className="text-white/50 text-xs font-medium uppercase tracking-wider">Opens</span>
          <div className="text-2xl font-bold tabular-nums mt-1 text-white">
            {openingTime || '--:--'}
          </div>
        </div>
        <div className="text-white/30 self-center text-lg">—</div>
        <div className="flex-1">
          <span className="text-white/50 text-xs font-medium uppercase tracking-wider">Closes</span>
          <div className="text-2xl font-bold tabular-nums mt-1 text-white">
            {closingTime || '--:--'}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-white/40 text-xs mb-1">Opening</label>
            <input
              type="time"
              value={openValue}
              onChange={(e) => setOpenValue(e.target.value)}
              className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#444] rounded-md text-white text-sm
                         focus:outline-none focus:border-[#6ea8fe] transition-colors"
            />
          </div>
          <div className="flex-1">
            <label className="block text-white/40 text-xs mb-1">Closing</label>
            <input
              type="time"
              value={closeValue}
              onChange={(e) => setCloseValue(e.target.value)}
              className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#444] rounded-md text-white text-sm
                         focus:outline-none focus:border-[#6ea8fe] transition-colors"
            />
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="w-full btn-quick px-4 py-2 bg-white text-black hover:bg-[#ddd] text-sm font-semibold
                     rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Set Hours'}
        </button>
      </div>
    </div>
  );
}

/* ── Reorder Arrows ── */
function ReorderButtons({
  onMove,
  isFirst,
  isLast,
}: {
  onMove: (dir: 'up' | 'down') => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div className="flex gap-0.5">
      <button
        onClick={() => onMove('up')}
        disabled={isFirst}
        className="p-1 text-white/30 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        title="Move up"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
      </button>
      <button
        onClick={() => onMove('down')}
        disabled={isLast}
        className="p-1 text-white/30 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        title="Move down"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
}

/* ── Ride Control Card ── */
function RideControl({
  attraction,
  onUpdate,
  onDelete,
  onMove,
  isFirst,
  isLast,
}: {
  attraction: Attraction;
  onUpdate: (id: string, updates: Partial<Attraction>) => Promise<void>;
  onDelete: (id: string, name: string) => void;
  onMove?: (dir: 'up' | 'down') => void;
  isFirst: boolean;
  isLast: boolean;
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
    <div style={{ background: '#111', border: '1px solid #333', borderRadius: 8, padding: 20, position: 'relative' }}>
      <SaveFeedback show={showSaved} />

      {/* Header: name + status badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <EditableName
            name={attraction.name}
            onSave={(newName) => {
              const newSlug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
              handleUpdate({ name: newName, slug: newSlug });
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {onMove && <ReorderButtons onMove={onMove} isFirst={isFirst} isLast={isLast} />}
          <span className={`${STATUS_COLORS[status]} text-white text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap`}>
            {status}
          </span>
        </div>
      </div>

      {/* Status select */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', color: '#888', fontSize: 12, fontWeight: 500, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Status</label>
        <select
          value={status}
          onChange={(e) => handleUpdate({ status: e.target.value as AttractionStatus })}
          disabled={saving}
          className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-[#444] rounded-md text-white text-sm
                     focus:outline-none focus:border-[#6ea8fe] transition-colors cursor-pointer
                     disabled:opacity-50"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Wait time display */}
      <div style={{ textAlign: 'center' as const, marginBottom: 16, padding: '12px 0', background: '#0a0a0a', borderRadius: 6 }}>
        <div style={{ color: '#888', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 4 }}>Wait Time</div>
        <div className={`text-4xl font-bold tabular-nums ${STATUS_TEXT_COLORS[status]}`}>
          {attraction.wait_time}
          <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>min</span>
        </div>
      </div>

      {/* Quick adjust buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => handleTimeAdjust(-5)}
          disabled={saving || attraction.wait_time <= 0}
          className="btn-quick py-2.5 bg-[#1a1a1a] border border-[#333] text-white rounded-md
                     hover:bg-[#222] text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed"
        >
          -5m
        </button>
        <button
          onClick={() => handleTimeAdjust(5)}
          disabled={saving}
          className="btn-quick py-2.5 bg-[#1a1a1a] border border-[#333] text-white rounded-md
                     hover:bg-[#222] text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed"
        >
          +5m
        </button>
        <button
          onClick={() => handleTimeAdjust(10)}
          disabled={saving}
          className="btn-quick py-2.5 bg-[#1a1a1a] border border-[#333] text-white rounded-md
                     hover:bg-[#222] text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed"
        >
          +10m
        </button>
      </div>

      {/* Custom time input */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="number"
          value={customTime}
          onChange={(e) => setCustomTime(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSetTime(); }}
          placeholder="Set min"
          min={0}
          max={180}
          className="flex-1 px-3 py-2.5 bg-[#1a1a1a] border border-[#444] rounded-md text-white text-sm
                     placeholder-white/30 focus:outline-none focus:border-[#6ea8fe] transition-colors
                     [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none
                     [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          onClick={handleSetTime}
          disabled={saving || !customTime}
          className="btn-quick px-4 py-2.5 bg-[#d43518] hover:bg-[#b52d14] text-white text-sm font-semibold
                     rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Set
        </button>
      </div>

      {/* Remove */}
      <div style={{ borderTop: '1px solid #222', paddingTop: 12 }}>
        <button
          onClick={() => onDelete(attraction.id, attraction.name)}
          className="w-full py-2 text-xs text-white/30 hover:text-[#d43518] hover:bg-[#d43518]/10
                     rounded-md transition-colors"
        >
          Remove Attraction
        </button>
      </div>
    </div>
  );
}

/* ── Show Control Card ── */
function ShowControl({
  attraction,
  onUpdate,
  onDelete,
  onMove,
  isFirst,
  isLast,
}: {
  attraction: Attraction;
  onUpdate: (id: string, updates: Partial<Attraction>) => Promise<void>;
  onDelete: (id: string, name: string) => void;
  onMove?: (dir: 'up' | 'down') => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [newTime, setNewTime] = useState('');

  const status = attraction.status as AttractionStatus;
  const showTimes: string[] = attraction.show_times || [];
  const sortedTimes = [...showTimes].sort();

  async function handleUpdate(updates: Partial<Attraction>) {
    setSaving(true);
    await onUpdate(attraction.id, updates);
    setSaving(false);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 1500);
  }

  function handleAddTime() {
    if (!newTime) return;
    if (showTimes.includes(newTime)) {
      setNewTime('');
      return;
    }
    handleUpdate({ show_times: [...showTimes, newTime] });
    setNewTime('');
  }

  function handleRemoveTime(time: string) {
    handleUpdate({ show_times: showTimes.filter((t) => t !== time) });
  }

  function handleClearAll() {
    handleUpdate({ show_times: [] });
  }

  return (
    <div style={{ background: 'rgba(88, 28, 135, 0.08)', border: '1px solid rgba(126, 34, 206, 0.3)', borderRadius: 8, padding: 20, position: 'relative' }}>
      <SaveFeedback show={showSaved} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <EditableName
            name={attraction.name}
            onSave={(newName) => {
              const newSlug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
              handleUpdate({ name: newName, slug: newSlug });
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {onMove && <ReorderButtons onMove={onMove} isFirst={isFirst} isLast={isLast} />}
          <span className="bg-purple-700 text-white text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap">
            SHOW
          </span>
          <span className={`${STATUS_COLORS[status]} text-white text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap`}>
            {status}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-[#888] text-xs font-medium mb-1.5 uppercase tracking-wider">Status</label>
        <select
          value={status}
          onChange={(e) => handleUpdate({ status: e.target.value as AttractionStatus })}
          disabled={saving}
          className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-[#444] rounded-md text-white text-sm
                     focus:outline-none focus:border-[#6ea8fe] focus:shadow-[0_0_0_2px_rgba(110,168,254,0.2)] transition-colors cursor-pointer
                     disabled:opacity-50"
        >
          {SHOW_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Show times list */}
      <div className="mb-3">
        <label className="block text-[#888] text-xs font-medium mb-2 uppercase tracking-wider">Show Times</label>
        {sortedTimes.length === 0 ? (
          <p className="text-white/30 text-xs italic mb-2">No show times added</p>
        ) : (
          <div className="flex flex-wrap gap-2 mb-2">
            {sortedTimes.map((time) => (
              <div
                key={time}
                className="flex items-center gap-1.5 bg-purple-900/40 border border-purple-500/30
                           text-purple-200 text-sm font-semibold px-3 py-1.5 rounded-md"
              >
                <span className="tabular-nums">{formatTime12h(time)}</span>
                <button
                  onClick={() => handleRemoveTime(time)}
                  disabled={saving}
                  className="text-purple-400/60 hover:text-[#dc3545] transition-colors ml-1
                             disabled:opacity-30"
                  title="Remove this time"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add new time */}
      <div className="flex gap-2 mb-3">
        <input
          type="time"
          value={newTime}
          onChange={(e) => setNewTime(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddTime(); }}
          className="flex-1 px-3 py-2.5 bg-[#1a1a1a] border border-[#444] rounded-md text-white text-sm
                     focus:outline-none focus:border-[#6ea8fe] focus:shadow-[0_0_0_2px_rgba(110,168,254,0.2)] transition-colors"
        />
        <button
          onClick={handleAddTime}
          disabled={saving || !newTime || showTimes.includes(newTime)}
          className="btn-quick px-4 py-2.5 bg-purple-700 hover:bg-purple-600 text-white text-sm font-semibold
                     rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>

      {sortedTimes.length > 0 && (
        <button
          onClick={handleClearAll}
          disabled={saving}
          className="w-full py-2 mb-3 text-xs text-purple-400/60 hover:text-purple-300 hover:bg-purple-900/20
                     rounded-md transition-colors disabled:opacity-30"
        >
          Clear All Times
        </button>
      )}

      <button
        onClick={() => onDelete(attraction.id, attraction.name)}
        className="w-full py-2 text-xs text-white/30 hover:text-[#dc3545] hover:bg-[#dc3545]/10
                   rounded-md transition-colors"
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
  const [openingTime, setOpeningTime] = useState('');
  const [closingTime, setClosingTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCloseAll, setShowCloseAll] = useState(false);
  const [closingAll, setClosingAll] = useState(false);
  const [showOpenAll, setShowOpenAll] = useState(false);
  const [openingAll, setOpeningAll] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [autoSort, setAutoSort] = useState(false);

  useEffect(() => {
    let attractionsChannel: ReturnType<typeof supabase.channel> | null = null;
    let settingsChannel: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      const auth = await checkAuth();
      if (!auth.authenticated || auth.role !== 'admin') {
        router.push('/login');
        return;
      }
      setUserEmail(auth.email || '');

      const [attractionsRes, openingRes, closingRes, autoSortRes] = await Promise.all([
        supabase.from('attractions').select('id,name,slug,status,wait_time,sort_order,attraction_type,show_times,updated_at').order('sort_order', { ascending: true }),
        supabase.from('park_settings').select('key,value').eq('key', 'opening_time').single(),
        supabase.from('park_settings').select('key,value').eq('key', 'closing_time').single(),
        supabase.from('park_settings').select('key,value').eq('key', 'auto_sort_by_wait').single(),
      ]);

      if (!attractionsRes.error) {
        setAttractions(attractionsRes.data || []);
      }
      if (openingRes.data) {
        setOpeningTime(openingRes.data.value);
      }
      if (closingRes.data) {
        setClosingTime(closingRes.data.value);
      }
      if (autoSortRes.data) {
        setAutoSort(autoSortRes.data.value === 'true');
      }
      setLoading(false);

      attractionsChannel = supabase
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

      settingsChannel = supabase
        .channel('admin-settings')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'park_settings' },
          (payload) => {
            const setting = payload.new as ParkSetting;
            if (setting.key === 'opening_time') {
              setOpeningTime(setting.value);
            } else if (setting.key === 'closing_time') {
              setClosingTime(setting.value);
            } else if (setting.key === 'auto_sort_by_wait') {
              setAutoSort(setting.value === 'true');
            }
          }
        )
        .subscribe();
    }

    init();

    return () => {
      if (attractionsChannel) supabase.removeChannel(attractionsChannel);
      if (settingsChannel) supabase.removeChannel(settingsChannel);
    };
  }, [router]);

  const handleUpdate = useCallback(async (id: string, updates: Partial<Attraction>) => {
    const { error } = await supabase
      .from('attractions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) console.error('Error updating attraction:', error);
  }, []);

  const handleOpeningTimeUpdate = useCallback(async (value: string) => {
    const { error } = await supabase
      .from('park_settings')
      .upsert({ key: 'opening_time', value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    if (error) console.error('Error updating opening time:', error);
  }, []);

  const handleClosingTimeUpdate = useCallback(async (value: string) => {
    const { error } = await supabase
      .from('park_settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', 'closing_time');

    if (error) console.error('Error updating closing time:', error);
  }, []);

  const handleAddAttraction = useCallback(async (name: string, type: AttractionType) => {
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
        attraction_type: type,
        show_times: [],
      });

    if (error) {
      console.error('Error adding attraction:', error);
      throw new Error(error.message);
    }
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

    const rideIds = attractions.filter((a) => a.attraction_type !== 'show').map((a) => a.id);
    await supabase
      .from('attractions')
      .update({ status: 'CLOSED', updated_at: new Date().toISOString() })
      .in('id', rideIds);

    setClosingAll(false);
  }

  async function handleOpenAll() {
    setOpeningAll(true);
    setShowOpenAll(false);

    const rideIds = attractions.filter((a) => a.attraction_type !== 'show').map((a) => a.id);
    const showIds = attractions.filter((a) => a.attraction_type === 'show').map((a) => a.id);

    if (rideIds.length > 0) {
      await supabase
        .from('attractions')
        .update({ status: 'OPEN', wait_time: 5, updated_at: new Date().toISOString() })
        .in('id', rideIds);
    }
    if (showIds.length > 0) {
      await supabase
        .from('attractions')
        .update({ status: 'OPEN', updated_at: new Date().toISOString() })
        .in('id', showIds);
    }

    setOpeningAll(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  async function handleToggleAutoSort() {
    const newValue = !autoSort;
    setAutoSort(newValue);
    await supabase
      .from('park_settings')
      .upsert({ key: 'auto_sort_by_wait', value: String(newValue), updated_at: new Date().toISOString() }, { onConflict: 'key' });
  }

  async function handleMoveAttraction(id: string, direction: 'up' | 'down') {
    const idx = attractions.findIndex((a) => a.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= attractions.length) return;

    const current = attractions[idx];
    const swap = attractions[swapIdx];

    // Swap sort_order values
    await Promise.all([
      supabase.from('attractions').update({ sort_order: swap.sort_order, updated_at: new Date().toISOString() }).eq('id', current.id),
      supabase.from('attractions').update({ sort_order: current.sort_order, updated_at: new Date().toISOString() }).eq('id', swap.id),
    ]);

    // Optimistic local update
    setAttractions((prev) => {
      const next = [...prev];
      next[idx] = { ...current, sort_order: swap.sort_order };
      next[swapIdx] = { ...swap, sort_order: current.sort_order };
      return next.sort((a, b) => a.sort_order - b.sort_order);
    });
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <h1 className="text-white text-3xl font-bold">Loading Dashboard...</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Close All Modal */}
      <ConfirmModal
        open={showCloseAll}
        title="Close All Rides?"
        message="This will set all rides to CLOSED immediately. Shows will not be affected. This is visible on the public displays instantly."
        confirmLabel="Yes, Close Rides"
        onConfirm={handleCloseAll}
        onCancel={() => setShowCloseAll(false)}
      />

      {/* Open All Modal */}
      <ConfirmModal
        open={showOpenAll}
        title="Open All Attractions?"
        message="This will set all attractions to OPEN and set ride wait times to 5 minutes. This is visible on the public displays instantly."
        confirmLabel="Yes, Open All"
        onConfirm={handleOpenAll}
        onCancel={() => setShowOpenAll(false)}
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

      <AdminNav userEmail={userEmail} onLogout={handleLogout} />

      <main style={{ padding: '24px 20px' }}>
      {/* Quick Actions */}
      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 mb-8">
        <div style={{ background: '#111', border: '1px solid #333', borderRadius: 8, padding: 20 }}>
          <h3 className="text-[#888] text-xs font-medium uppercase tracking-wider mb-4">Quick Actions</h3>
          <div className="flex gap-3">
            <button onClick={() => setShowOpenAll(true)} disabled={openingAll}
              className="flex-1 btn-quick px-4 py-3.5 bg-[#22C55E] hover:bg-[#16a34a] text-black font-bold rounded-md text-sm transition-colors disabled:opacity-50">
              {openingAll ? 'Opening...' : 'Open All Rides'}
            </button>
            <button onClick={() => setShowCloseAll(true)} disabled={closingAll}
              className="flex-1 btn-quick px-4 py-3.5 bg-[#dc3545] hover:bg-[#c82333] text-white font-bold rounded-md text-sm transition-colors disabled:opacity-50">
              {closingAll ? 'Closing...' : 'Close All Rides'}
            </button>
          </div>
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[#333]">
            <button onClick={handleToggleAutoSort}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoSort ? 'bg-[#22C55E]' : 'bg-[#222] border border-[#444]'}`}>
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${autoSort ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className="text-[#888] text-sm">
              Auto-sort by wait time {autoSort ? <span className="text-[#22C55E] font-semibold">(ON)</span> : <span className="text-white/30">(OFF)</span>}
            </span>
          </div>
        </div>
        <OperatingHoursControl openingTime={openingTime} closingTime={closingTime} onUpdateOpening={handleOpeningTimeUpdate} onUpdateClosing={handleClosingTimeUpdate} />
      </div>

      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {attractions.map((attraction, idx) =>
          attraction.attraction_type === 'show' ? (
            <ShowControl
              key={attraction.id}
              attraction={attraction}
              onUpdate={handleUpdate}
              onDelete={(id, name) => setDeleteTarget({ id, name })}
              onMove={!autoSort ? (dir) => handleMoveAttraction(attraction.id, dir) : undefined}
              isFirst={idx === 0}
              isLast={idx === attractions.length - 1}
            />
          ) : (
            <RideControl
              key={attraction.id}
              attraction={attraction}
              onUpdate={handleUpdate}
              onDelete={(id, name) => setDeleteTarget({ id, name })}
              onMove={!autoSort ? (dir) => handleMoveAttraction(attraction.id, dir) : undefined}
              isFirst={idx === 0}
              isLast={idx === attractions.length - 1}
            />
          )
        )}
        <AddAttractionForm onAdd={handleAddAttraction} />
      </div>
      </main>
    </div>
  );
}
