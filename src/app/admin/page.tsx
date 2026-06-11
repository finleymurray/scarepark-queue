'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkAuth } from '@/lib/auth';
import AdminNav from '@/components/AdminNav';
import { logAudit } from '@/lib/audit';
import { logStatusChange, resolveDelay, DELAY_REASONS } from '@/lib/statusLog';
import { resolveLogo, resolveLogoGlow } from '@/lib/logos';
import { getAllSignoffStatuses, getTodayDateStr } from '@/lib/signoff';
import type { AttractionSignoffStatus } from '@/lib/signoff';
import type { Attraction, AttractionStatus, AttractionType, ParkSetting, DelayReason } from '@/types/database';
import { surface, border, text as textTok, accents, radius, FONT_NUM, microLabel, card, controlButton, primaryButton } from '@/lib/theme';
import { useToasts, ToastStack } from '@/components/ui/Toast';

const STATUS_OPTIONS: AttractionStatus[] = ['OPEN', 'CLOSED', 'DELAYED', 'AT CAPACITY'];
const SHOW_STATUS_OPTIONS: AttractionStatus[] = ['OPEN', 'DELAYED'];

const STATUS_COLORS: Record<AttractionStatus, string> = {
  'OPEN': 'bg-[#22C55E]',
  'CLOSED': 'bg-[#EF4444]',
  'DELAYED': 'bg-[#F59E0B]',
  'AT CAPACITY': 'bg-[#F59E0B]',
};

const STATUS_INLINE_COLORS: Record<AttractionStatus, string> = {
  'OPEN': '#22C55E',
  'CLOSED': '#EF4444',
  'DELAYED': '#F59E0B',
  'AT CAPACITY': '#F59E0B',
};

const STATUS_PILL_BG: Record<AttractionStatus, string> = {
  'OPEN': '#22C55E',
  'CLOSED': '#EF4444',
  'DELAYED': '#F59E0B',
  'AT CAPACITY': '#F59E0B',
};

const STATUS_PILL_TEXT: Record<AttractionStatus, string> = {
  'OPEN': '#000',
  'CLOSED': '#fff',
  'DELAYED': '#000',
  'AT CAPACITY': '#000',
};

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

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
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: surface.card, border: `1px solid ${border.default}`, borderRadius: radius.xl, padding: 24, maxWidth: 400, width: '100%', textAlign: 'center' as const }}>
        {/* Icon in soft tinted square */}
        <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(239,68,68,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h2 style={{ color: textTok.primary, fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>{title}</h2>
        <p style={{ color: textTok.muted, fontSize: 13, lineHeight: 1.5, margin: '0 0 20px' }}>{message}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{ ...controlButton, flex: 1, minHeight: 48, padding: '12px 16px', fontSize: 13, fontWeight: 600, borderRadius: 10 }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{ ...primaryButton('admin'), flex: 1, minHeight: 48, padding: '12px 16px', fontSize: 13, borderRadius: 10 }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Delay Reason Modal ── */
function DelayReasonModal({
  open,
  attractionName,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  attractionName: string;
  onConfirm: (reason: DelayReason, notes: string) => void;
  onCancel: () => void;
}) {
  const [selectedReason, setSelectedReason] = useState<DelayReason | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setSelectedReason(null);
      setNotes('');
    }
  }, [open]);

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: surface.card, border: `1px solid ${border.default}`, borderRadius: radius.xl, padding: 24, maxWidth: 480, width: '100%' }}>
        <h2 style={{ color: textTok.primary, fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>Delay Reason</h2>
        <p style={{ color: textTok.muted, fontSize: 13, margin: '0 0 20px' }}>
          Why is <span style={{ color: textTok.primary, fontWeight: 500 }}>{attractionName}</span> being delayed?
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {DELAY_REASONS.map((reason) => {
            const selected = selectedReason === reason;
            return (
              <button
                key={reason}
                onClick={() => setSelectedReason(reason)}
                style={{
                  padding: '12px 8px',
                  minHeight: 52,
                  borderRadius: 12,
                  border: selected ? `1.5px solid ${accents.signoff.base}` : `1px solid ${border.strong}`,
                  background: selected ? 'rgba(245,158,11,0.08)' : surface.control,
                  color: selected ? accents.signoff.text : textTok.secondary,
                  fontSize: 13,
                  fontWeight: selected ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {reason}
              </button>
            );
          })}
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', color: textTok.muted, fontSize: 12, marginBottom: 6 }}>
            Notes (optional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional details..."
            style={{
              width: '100%',
              padding: '12px 14px',
              background: surface.control,
              border: `1px solid ${border.strong}`,
              borderRadius: 10,
              color: textTok.primary,
              fontSize: 13,
              outline: 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              boxSizing: 'border-box' as const,
            }}
            onFocus={(e) => {
              e.target.style.borderColor = accents.signoff.base;
              e.target.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.15)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = border.strong;
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{ ...controlButton, flex: 1, minHeight: 48, padding: '12px 16px', fontSize: 13, fontWeight: 600, borderRadius: 10 }}
          >
            Cancel
          </button>
          <button
            onClick={() => selectedReason && onConfirm(selectedReason, notes)}
            disabled={!selectedReason}
            style={{
              flex: 1,
              minHeight: 48,
              padding: '12px 16px',
              background: selectedReason ? '#D97706' : surface.raised,
              color: selectedReason ? '#fff' : textTok.faint,
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 10,
              border: 'none',
              cursor: selectedReason ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
            }}
          >
            Confirm Delay
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
        className="text-[#F8FAFC] text-lg font-bold bg-[#13161C] border border-[#2E3543] rounded-md px-2 py-0.5 mr-2
                   focus:outline-none focus:border-[#EF4444] transition-colors min-w-0 flex-1"
      />
    );
  }

  return (
    <h3
      onClick={() => setEditing(true)}
      className="text-[#F8FAFC] text-lg font-bold truncate mr-2 cursor-pointer hover:text-[#94A3B8] transition-colors"
      title="Click to edit name"
    >
      {name}
      <svg className="w-3.5 h-3.5 inline-block ml-2 text-[#94A3B8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    </h3>
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
    <div style={{ ...card(), padding: 24, position: 'relative' }}>
      <SaveFeedback show={showSaved} />

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[#F8FAFC] text-base font-semibold" style={{ textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.06em' }}>Operating Hours</h3>
        <span style={{ background: surface.raised, color: textTok.secondary, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, letterSpacing: '0.04em' }}>INFO</span>
      </div>

      <div className="flex gap-4 text-center mb-3">
        <div className="flex-1">
          <span style={{ color: textTok.secondary, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Opens</span>
          <div style={{ color: textTok.primary, fontSize: 24, fontWeight: 700, ...FONT_NUM, marginTop: 4 }}>
            {openingTime || '--:--'}
          </div>
        </div>
        <div style={{ color: textTok.muted, alignSelf: 'center', fontSize: 18 }}>—</div>
        <div className="flex-1">
          <span style={{ color: textTok.secondary, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Closes</span>
          <div style={{ color: textTok.primary, fontSize: 24, fontWeight: 700, ...FONT_NUM, marginTop: 4 }}>
            {closingTime || '--:--'}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', color: textTok.secondary, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Opening</label>
            <input
              type="time"
              value={openValue}
              onChange={(e) => setOpenValue(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', background: surface.control, border: `1px solid ${border.strong}`, borderRadius: 8, color: textTok.primary, fontSize: 14, outline: 'none', minHeight: 44 }}
              onFocus={(e) => { e.target.style.borderColor = accents.admin.base; }}
              onBlur={(e) => { e.target.style.borderColor = border.strong; }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', color: textTok.secondary, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Closing</label>
            <input
              type="time"
              value={closeValue}
              onChange={(e) => setCloseValue(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', background: surface.control, border: `1px solid ${border.strong}`, borderRadius: 8, color: textTok.primary, fontSize: 14, outline: 'none', minHeight: 44 }}
              onFocus={(e) => { e.target.style.borderColor = accents.admin.base; }}
              onBlur={(e) => { e.target.style.borderColor = border.strong; }}
            />
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          style={{
            ...primaryButton('admin'),
            width: '100%', padding: '11px 0', marginTop: 8,
            fontSize: 13, fontWeight: 700, cursor: saving || !hasChanges ? 'not-allowed' : 'pointer',
            opacity: saving || !hasChanges ? 0.3 : 1, transition: 'opacity 0.15s', minHeight: 44,
          }}
          className="btn-quick"
        >
          {saving ? 'Saving…' : 'Set Hours'}
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
        className="p-1 text-[#94A3B8] hover:text-[#F8FAFC] disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        title="Move up"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
      </button>
      <button
        onClick={() => onMove('down')}
        disabled={isLast}
        className="p-1 text-[#94A3B8] hover:text-[#F8FAFC] disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        title="Move down"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
}

/* ── Target Dispatch Field ── */
function TargetDispatchField({ value, onSave }: { value: number | null; onSave: (v: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');

  function startEdit() {
    setInput(value !== null ? String(value) : '90');
    setEditing(true);
  }

  function confirm() {
    const n = parseInt(input, 10);
    if (!isNaN(n) && n > 0) onSave(n);
    setEditing(false);
  }

  return (
    <div style={{ borderTop: `1px solid ${border.divider}`, paddingTop: 12, marginBottom: 4, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ color: textTok.muted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Target Dispatch</span>
      {editing ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="number"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') setEditing(false); }}
            autoFocus
            min={1}
            max={600}
            style={{ width: 64, padding: '4px 8px', background: surface.control, border: `1px solid ${accents.admin.base}`, borderRadius: 6, color: textTok.primary, fontSize: 13, outline: 'none' }}
          />
          <span style={{ color: textTok.muted, fontSize: 12 }}>s</span>
          <button onClick={confirm} style={{ padding: '4px 10px', background: accents.admin.strong, border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>OK</button>
          <button onClick={() => setEditing(false)} style={{ ...controlButton, padding: '4px 8px', fontSize: 12 }}>✕</button>
        </div>
      ) : (
        <button
          onClick={startEdit}
          style={{ fontSize: 13, fontWeight: 600, color: textTok.secondary, background: 'transparent', border: `1px solid ${border.strong}`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = accents.admin.base; e.currentTarget.style.color = textTok.primary; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = border.strong; e.currentTarget.style.color = textTok.secondary; }}
        >
          {value !== null ? `${value}s` : '90s'}
        </button>
      )}
    </div>
  );
}

/* ── Ride Control Card ── */
const RideControl = React.memo(function RideControl({
  attraction,
  onUpdate,
  onDelete,
  onMove,
  isFirst,
  isLast,
  signoffStatus,
}: {
  attraction: Attraction;
  onUpdate: (id: string, updates: Partial<Attraction>) => Promise<void>;
  onDelete: (id: string, name: string) => void;
  onMove?: (dir: 'up' | 'down') => void;
  isFirst: boolean;
  isLast: boolean;
  signoffStatus?: AttractionSignoffStatus;
}) {
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [customTime, setCustomTime] = useState('');
  const [delayStartedAt, setDelayStartedAt] = useState<string | null>(null);
  const [delayElapsed, setDelayElapsed] = useState(0);

  const status = attraction.status as AttractionStatus;

  // Fetch delay start time when DELAYED
  useEffect(() => {
    if (status !== 'DELAYED') {
      setDelayStartedAt(null);
      setDelayElapsed(0);
      return;
    }
    let cancelled = false;
    async function fetchDelay() {
      const { data } = await supabase
        .from('attraction_status_logs')
        .select('changed_at')
        .eq('attraction_id', attraction.id)
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
  }, [attraction.id, status]);

  useEffect(() => {
    if (!delayStartedAt) return;
    const interval = setInterval(() => {
      setDelayElapsed(Math.floor((Date.now() - new Date(delayStartedAt).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [delayStartedAt]);

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
    <div style={{ ...card(status), padding: 24, position: 'relative', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 4 }}>
      <SaveFeedback show={showSaved} />

      {/* Reorder buttons — top right corner */}
      {onMove && (
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 2 }}>
          <ReorderButtons onMove={onMove} isFirst={isFirst} isLast={isLast} />
        </div>
      )}

      {/* Status select — pill badge style */}
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <select
          key={`status-${attraction.id}-${status}`}
          value={status}
          onChange={(e) => handleUpdate({ status: e.target.value as AttractionStatus })}
          disabled={saving}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none' as never,
            padding: '6px 30px 6px 14px',
            fontSize: 12,
            fontWeight: 800,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.04em',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            transition: 'filter 0.15s',
            backgroundColor: STATUS_PILL_BG[status] || '#555',
            color: STATUS_PILL_TEXT[status] || '#fff',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath d='M0 2l4 4 4-4' fill='${encodeURIComponent(STATUS_PILL_TEXT[status] || '#fff')}' /%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
            backgroundSize: '8px',
            opacity: saving ? 0.5 : 1,
            outline: 'none',
          }}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {status === 'DELAYED' && delayStartedAt && (
          <span style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B', ...FONT_NUM, letterSpacing: '0.05em' }}>
            {formatElapsed(delayElapsed)}
          </span>
        )}
      </div>

      {/* Logo + Name — centred */}
      <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 6, marginBottom: 4 }}>
        {(() => {
          const logo = resolveLogo(attraction);
          const glow = resolveLogoGlow(attraction);
          return logo ? (
            <img src={logo} alt="" width={80} height={80} loading="lazy" decoding="async" className="rounded object-contain" style={{ width: 80, height: 80, filter: glow || undefined }} />
          ) : null;
        })()}
        <div style={{ textAlign: 'center' as const }}>
          <EditableName
            name={attraction.name}
            onSave={(newName) => {
              const newSlug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
              handleUpdate({ name: newName, slug: newSlug });
            }}
          />
        </div>
      </div>

      {/* Sign-off badge — centred */}
      {signoffStatus && (
        <div style={{ marginBottom: 4 }}>
          {signoffStatus.openingTotal > 0 && signoffStatus.openingCompleted === signoffStatus.openingTotal ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 6, background: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.2)' }}>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Signed Off
            </span>
          ) : signoffStatus.openingTotal > 0 && signoffStatus.openingCompleted > 0 ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 6, background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}>
              {signoffStatus.openingCompleted}/{signoffStatus.openingTotal} Signed Off
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
              Not Signed Off
            </span>
          )}
        </div>
      )}

      {/* Wait time display */}
      <div style={{ textAlign: 'center' as const, marginBottom: 12, padding: '4px 0' }}>
        <div className="text-6xl font-bold tabular-nums" style={{ color: STATUS_INLINE_COLORS[status] }}>
          {attraction.wait_time}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'lowercase' as const, letterSpacing: '0.05em' }}>min</div>
      </div>

      {/* Quick adjust buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 12, width: '100%' }}>
        {([-10, -5, 5, 10] as const).map((delta) => (
          <button
            key={delta}
            onClick={() => handleTimeAdjust(delta)}
            disabled={saving || (delta < 0 && attraction.wait_time <= 0)}
            style={{
              padding: '10px 4px',
              background: 'transparent',
              border: `1px solid ${delta < 0 ? '#EF4444' : '#22C55E'}`,
              borderRadius: 8,
              color: delta < 0 ? '#EF4444' : '#22C55E',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              minHeight: 42,
              opacity: (saving || (delta < 0 && attraction.wait_time <= 0)) ? 0.3 : 1,
              transition: 'opacity 0.15s',
            }}
            className="btn-quick"
          >
            {delta > 0 ? `+${delta}` : delta}m
          </button>
        ))}
      </div>

      {/* Custom time input */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, width: '100%' }}>
        <input
          type="number"
          value={customTime}
          onChange={(e) => setCustomTime(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSetTime(); }}
          placeholder="Set min"
          min={0}
          max={180}
          style={{
            flex: 1, padding: '10px 12px',
            background: surface.control, border: `1px solid ${border.strong}`, borderRadius: 8,
            color: textTok.primary, fontSize: 14, outline: 'none', minHeight: 44,
          }}
          className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          onFocus={(e) => { e.target.style.borderColor = accents.admin.base; }}
          onBlur={(e) => { e.target.style.borderColor = border.strong; }}
        />
        <button
          onClick={handleSetTime}
          disabled={saving || !customTime}
          style={{
            padding: '10px 18px', background: accents.admin.strong, border: 'none',
            borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700,
            cursor: !customTime || saving ? 'not-allowed' : 'pointer',
            opacity: !customTime || saving ? 0.3 : 1, minHeight: 44,
            transition: 'opacity 0.15s',
          }}
          className="btn-quick"
        >
          Set
        </button>
      </div>

      {/* Target Dispatch */}
      <TargetDispatchField
        value={attraction.target_dispatch_seconds ?? null}
        onSave={(val) => handleUpdate({ target_dispatch_seconds: val })}
      />

      {/* Remove */}
      <div style={{ borderTop: `1px solid ${border.divider}`, paddingTop: 12, width: '100%' }}>
        <button
          onClick={() => onDelete(attraction.id, attraction.name)}
          className="w-full py-2 text-xs text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#EF4444]/10
                     rounded-md transition-colors"
        >
          Remove Attraction
        </button>
      </div>
    </div>
  );
});

/* ── Show Control Card ── */
const ShowControl = React.memo(function ShowControl({
  attraction,
  onUpdate,
  onDelete,
  onMove,
  isFirst,
  isLast,
  signoffStatus,
}: {
  attraction: Attraction;
  onUpdate: (id: string, updates: Partial<Attraction>) => Promise<void>;
  onDelete: (id: string, name: string) => void;
  onMove?: (dir: 'up' | 'down') => void;
  isFirst: boolean;
  isLast: boolean;
  signoffStatus?: AttractionSignoffStatus;
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
    <div style={{ ...card(status), padding: 20, position: 'relative' }}>
      <SaveFeedback show={showSaved} />

      {/* Header row: SHOW badge + status + reorder */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ background: 'rgba(126,34,206,0.3)', color: '#c084fc', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5, letterSpacing: '0.05em' }}>
            SHOW
          </span>
          <select
            key={`status-${attraction.id}-${status}`}
            value={status}
            onChange={(e) => handleUpdate({ status: e.target.value as AttractionStatus })}
            disabled={saving}
            style={{
              appearance: 'none', WebkitAppearance: 'none',
              padding: '6px 28px 6px 12px', fontSize: 12, fontWeight: 700,
              textTransform: 'uppercase' as const, letterSpacing: '0.04em',
              borderRadius: 6, border: 'none', cursor: 'pointer',
              backgroundColor: STATUS_PILL_BG[status] || '#555',
              color: STATUS_PILL_TEXT[status] || '#fff',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath d='M0 2l4 4 4-4' fill='${encodeURIComponent(STATUS_PILL_TEXT[status] || '#fff')}' /%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 9px center', backgroundSize: '8px',
              opacity: saving ? 0.5 : 1, outline: 'none',
            }}
          >
            {SHOW_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {onMove && <ReorderButtons onMove={onMove} isFirst={isFirst} isLast={isLast} />}
      </div>

      {/* Logo + Name */}
      <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {(() => {
          const logo = resolveLogo(attraction);
          const glow = resolveLogoGlow(attraction);
          return logo ? (
            <img src={logo} alt="" width={72} height={72} loading="lazy" decoding="async" className="rounded object-contain" style={{ width: 72, height: 72, filter: glow || undefined }} />
          ) : null;
        })()}
        <EditableName name={attraction.name} onSave={(newName) => {
          const newSlug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          handleUpdate({ name: newName, slug: newSlug });
        }} />
      </div>

      {/* Sign-off badge — centred */}
      {signoffStatus && (
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
          {signoffStatus.openingTotal > 0 && signoffStatus.openingCompleted === signoffStatus.openingTotal ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 6, background: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.2)' }}>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Signed Off
            </span>
          ) : signoffStatus.openingTotal > 0 && signoffStatus.openingCompleted > 0 ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 6, background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}>
              {signoffStatus.openingCompleted}/{signoffStatus.openingTotal} Signed Off
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
              Not Signed Off
            </span>
          )}
        </div>
      )}

      {/* Show times */}
      <div style={{ width: '100%' }}>
        <p style={{ color: textTok.secondary, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Show Times</p>

        {sortedTimes.length === 0 ? (
          <p style={{ color: textTok.faint, fontSize: 12, fontStyle: 'italic', marginBottom: 10 }}>No show times added</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {sortedTimes.map((time) => (
              <div key={time} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(126,34,206,0.15)', border: '1px solid rgba(126,34,206,0.3)', color: '#c084fc', fontSize: 13, fontWeight: 600, padding: '7px 12px', borderRadius: 8, minHeight: 38 }}>
                <span className="tabular-nums">{formatTime12h(time)}</span>
                <button onClick={() => handleRemoveTime(time)} disabled={saving}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7c3aed', padding: 2, lineHeight: 1, opacity: saving ? 0.3 : 1 }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add time row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddTime(); }}
            style={{ flex: 1, padding: '10px 12px', background: surface.control, border: `1px solid ${border.strong}`, borderRadius: 8, color: textTok.primary, fontSize: 14, outline: 'none', minHeight: 44 }}
          />
          <button onClick={handleAddTime} disabled={saving || !newTime || showTimes.includes(newTime)}
            style={{ padding: '10px 18px', background: 'rgba(126,34,206,0.6)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (!newTime || showTimes.includes(newTime)) ? 0.3 : 1, minHeight: 44 }}>
            Add
          </button>
        </div>
      </div>

      {/* Footer actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${border.divider}` }}>
        {sortedTimes.length > 0 && (
          <button onClick={handleClearAll} disabled={saving}
            style={{ flex: 1, padding: '9px 8px', background: 'transparent', border: `1px solid ${border.strong}`, borderRadius: 8, color: textTok.muted, fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: saving ? 0.3 : 1 }}>
            Clear Times
          </button>
        )}
        <button onClick={() => onDelete(attraction.id, attraction.name)}
          style={{ flex: sortedTimes.length > 0 ? '0 0 auto' : 1, padding: '9px 12px', background: 'transparent', border: `1px solid ${border.strong}`, borderRadius: 8, color: textTok.muted, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
          Remove
        </button>
      </div>
    </div>
  );
});

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
  const [displayName, setDisplayName] = useState('');
  const [autoSort, setAutoSort] = useState(false);
  const [signoffStatuses, setSignoffStatuses] = useState<Map<string, AttractionSignoffStatus>>(new Map());
  const [delayModal, setDelayModal] = useState<{
    attractionId: string;
    attractionName: string;
    previousStatus: AttractionStatus;
  } | null>(null);
  const attractionsRef = useRef<Attraction[]>([]);
  const userEmailRef = useRef('');
  const displayNameRef = useRef('');
  const signoffDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toasts, pushToast } = useToasts();

  /** Re-sync local attractions state from the server (used after failed bulk ops). */
  const refetchAttractions = useCallback(async () => {
    const { data, error } = await supabase
      .from('attractions')
      .select('id,name,slug,status,wait_time,sort_order,attraction_type,show_times,updated_at,target_dispatch_seconds,logo_url,bg_url,queue_bg_url,glow_rgb,text_color,text_rgb,fear_rating')
      .order('sort_order', { ascending: true });
    if (!error && data) setAttractions(data);
  }, []);

  // Keep refs in sync for stable callbacks
  attractionsRef.current = attractions;
  userEmailRef.current = userEmail;
  displayNameRef.current = displayName;

  useEffect(() => {
    let attractionsChannel: ReturnType<typeof supabase.channel> | null = null;
    let settingsChannel: ReturnType<typeof supabase.channel> | null = null;
    let signoffChannel: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      const auth = await checkAuth();
      if (!auth.authenticated || auth.role !== 'admin') {
        router.push('/login');
        return;
      }
      setUserEmail(auth.email || '');
      setDisplayName(auth.displayName || '');

      const [attractionsRes, openingRes, closingRes, autoSortRes] = await Promise.all([
        supabase.from('attractions').select('id,name,slug,status,wait_time,sort_order,attraction_type,show_times,updated_at,target_dispatch_seconds,logo_url,bg_url,queue_bg_url,glow_rgb,text_color,text_rgb,fear_rating').order('sort_order', { ascending: true }),
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

      // Fetch signoff statuses
      if (attractionsRes.data && attractionsRes.data.length > 0) {
        const ids = attractionsRes.data.map((a: Attraction) => a.id);
        const statuses = await getAllSignoffStatuses(ids);
        setSignoffStatuses(statuses);
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

      // Signoff completions realtime (debounced to batch rapid updates)
      signoffChannel = supabase
        .channel('admin-signoff')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'signoff_completions' },
          () => {
            if (signoffDebounceRef.current) clearTimeout(signoffDebounceRef.current);
            signoffDebounceRef.current = setTimeout(async () => {
              const currentAttractions = attractionsRef.current;
              if (currentAttractions.length > 0) {
                const ids = currentAttractions.map((a) => a.id);
                const statuses = await getAllSignoffStatuses(ids);
                setSignoffStatuses(statuses);
              }
            }, 2000);
          }
        )
        .subscribe();
    }

    init();

    return () => {
      if (attractionsChannel) supabase.removeChannel(attractionsChannel);
      if (settingsChannel) supabase.removeChannel(settingsChannel);
      if (signoffChannel) supabase.removeChannel(signoffChannel);
    };
  }, [router]);

  const handleUpdate = useCallback(async (id: string, updates: Partial<Attraction>) => {
    const current = attractionsRef.current.find((a) => a.id === id);

    // Intercept DELAYED transitions — show reason modal instead of immediate update
    if (current && 'status' in updates && updates.status === 'DELAYED' && current.status !== 'DELAYED') {
      setDelayModal({
        attractionId: id,
        attractionName: current.name,
        previousStatus: current.status as AttractionStatus,
      });
      return;
    }

    // Validate numeric fields before sending (M6 fix)
    const sanitised = { ...updates };
    if ('wait_time' in sanitised && sanitised.wait_time !== undefined) {
      sanitised.wait_time = Math.max(0, Math.min(180, Math.round(sanitised.wait_time as number)));
    }

    const { error } = await supabase
      .from('attractions')
      .update({ ...sanitised, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      if (process.env.NODE_ENV === 'development') console.error('Error updating attraction:', error);
      pushToast('error', `Failed to update ${current?.name || 'attraction'}`);
      return;
    }

    if (current) {
      const performer = displayNameRef.current || userEmailRef.current;
      try {
      if ('status' in updates && updates.status !== current.status) {
        await logAudit({
          actionType: 'status_change',
          attractionId: id,
          attractionName: current.name,
          performedBy: performer,
          oldValue: current.status,
          newValue: updates.status!,
          details: `Status changed from ${current.status} to ${updates.status}`,
        });

        // Structured status log
        await logStatusChange({
          attractionId: id,
          status: updates.status as AttractionStatus,
          previousStatus: current.status as AttractionStatus,
          changedBy: performer,
        });

        // Resolve previous delay if transitioning FROM DELAYED
        if (current.status === 'DELAYED') {
          await resolveDelay(id);
        }
      }
      if ('wait_time' in updates && updates.wait_time !== current.wait_time) {
        await logAudit({
          actionType: 'queue_time_change',
          attractionId: id,
          attractionName: current.name,
          performedBy: performer,
          oldValue: String(current.wait_time),
          newValue: String(updates.wait_time),
          details: `Wait time changed from ${current.wait_time}min to ${updates.wait_time}min`,
        });
      }
      if ('show_times' in updates) {
        const oldTimes = current.show_times || [];
        const newTimes = updates.show_times || [];
        const added = newTimes.filter((t) => !oldTimes.includes(t));
        const removed = oldTimes.filter((t) => !newTimes.includes(t));
        for (const time of added) {
          await logAudit({
            actionType: 'show_time_added',
            attractionId: id,
            attractionName: current.name,
            performedBy: performer,
            newValue: time,
          });
        }
        for (const time of removed) {
          await logAudit({
            actionType: 'show_time_removed',
            attractionId: id,
            attractionName: current.name,
            performedBy: performer,
            newValue: time,
          });
        }
      }
      } catch (e) {
        // Never block UX on audit failure — but record it
        console.error('Audit logging failed:', e);
      }
    }
  }, [pushToast]);

  const handleDelayConfirm = useCallback(async (reason: DelayReason, notes: string) => {
    if (!delayModal) return;
    const { attractionId, attractionName, previousStatus } = delayModal;
    setDelayModal(null);

    const { error } = await supabase
      .from('attractions')
      .update({ status: 'DELAYED', updated_at: new Date().toISOString() })
      .eq('id', attractionId);

    if (error) {
      if (process.env.NODE_ENV === 'development') console.error('Error updating attraction:', error);
      pushToast('error', `Failed to delay ${attractionName}`);
      return;
    }

    const performer = displayNameRef.current || userEmailRef.current;

    try {
    await logAudit({
      actionType: 'status_change',
      attractionId,
      attractionName,
      performedBy: performer,
      oldValue: previousStatus,
      newValue: 'DELAYED',
      details: `Status changed from ${previousStatus} to DELAYED. Reason: ${reason}${notes ? '. ' + notes : ''}`,
    });

    await logStatusChange({
      attractionId,
      status: 'DELAYED',
      previousStatus,
      reason,
      notes: notes || null,
      changedBy: performer,
    });
    } catch (e) {
      console.error('Audit logging failed:', e);
    }
  }, [delayModal, pushToast]);

  const handleOpeningTimeUpdate = useCallback(async (value: string) => {
    const { error } = await supabase
      .from('park_settings')
      .upsert({ key: 'opening_time', value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    if (error) {
      if (process.env.NODE_ENV === 'development') console.error('Error updating opening time:', error);
      pushToast('error', 'Failed to update opening time');
    }
  }, [pushToast]);

  const handleClosingTimeUpdate = useCallback(async (value: string) => {
    const { error } = await supabase
      .from('park_settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', 'closing_time');

    if (error) {
      if (process.env.NODE_ENV === 'development') console.error('Error updating closing time:', error);
      pushToast('error', 'Failed to update closing time');
    }
  }, [pushToast]);

  const handleDeleteAttraction = useCallback(async (id: string, name: string) => {
    const current = attractionsRef.current.find((a) => a.id === id);
    const attractionName = current?.name || name;
    const attractionType = current?.attraction_type === 'show' ? 'Show' : 'Ride';

    // Log before delete so the FK reference is still valid
    const performer = displayNameRef.current || userEmailRef.current;
    try {
      await logAudit({
        actionType: 'attraction_deleted',
        attractionId: id,
        attractionName,
        performedBy: performer,
        oldValue: attractionType,
      });
    } catch (e) {
      console.error('Audit logging failed:', e);
    }

    const { error } = await supabase
      .from('attractions')
      .delete()
      .eq('id', id);

    if (error) {
      if (process.env.NODE_ENV === 'development') console.error('Error deleting attraction:', error);
      pushToast('error', `Failed to remove ${attractionName}`);
    }
    setDeleteTarget(null);
  }, [pushToast]);

  async function handleCloseAll() {
    setClosingAll(true);
    setShowCloseAll(false);

    const rides = attractions.filter((a) => a.attraction_type !== 'show');
    const rideIds = rides.map((a) => a.id);
    try {
      const { error } = await supabase
        .from('attractions')
        .update({ status: 'CLOSED', updated_at: new Date().toISOString() })
        .in('id', rideIds);
      if (error) throw error;
    } catch (e) {
      console.error('Bulk close failed:', e);
      pushToast('error', `Failed to close ${rideIds.length} ride${rideIds.length !== 1 ? 's' : ''}`);
      await refetchAttractions();
      setClosingAll(false);
      return;
    }

    const performer = displayName || userEmail;
    try {
    for (const ride of rides) {
      if (ride.status !== 'CLOSED') {
        await logAudit({
          actionType: 'status_change',
          attractionId: ride.id,
          attractionName: ride.name,
          performedBy: performer,
          oldValue: ride.status,
          newValue: 'CLOSED',
          details: 'Bulk close all rides',
        });
        await logStatusChange({
          attractionId: ride.id,
          status: 'CLOSED',
          previousStatus: ride.status as AttractionStatus,
          changedBy: performer,
        });
        if (ride.status === 'DELAYED') {
          await resolveDelay(ride.id);
        }
      }
    }
    } catch (e) {
      console.error('Audit logging failed:', e);
    }

    setClosingAll(false);
  }

  async function handleOpenAll() {
    setOpeningAll(true);
    setShowOpenAll(false);

    const rides = attractions.filter((a) => a.attraction_type !== 'show');
    const shows = attractions.filter((a) => a.attraction_type === 'show');
    const rideIds = rides.map((a) => a.id);
    const showIds = shows.map((a) => a.id);

    const failures: string[] = [];
    if (rideIds.length > 0) {
      try {
        const { error } = await supabase
          .from('attractions')
          .update({ status: 'OPEN', wait_time: 5, updated_at: new Date().toISOString() })
          .in('id', rideIds);
        if (error) throw error;
      } catch (e) {
        console.error('Bulk open rides failed:', e);
        failures.push(`${rideIds.length} ride${rideIds.length !== 1 ? 's' : ''}`);
      }
    }
    if (showIds.length > 0) {
      try {
        const { error } = await supabase
          .from('attractions')
          .update({ status: 'OPEN', updated_at: new Date().toISOString() })
          .in('id', showIds);
        if (error) throw error;
      } catch (e) {
        console.error('Bulk open shows failed:', e);
        failures.push(`${showIds.length} show${showIds.length !== 1 ? 's' : ''}`);
      }
    }
    if (failures.length > 0) {
      pushToast('error', `Failed to open ${failures.join(' and ')}`);
      await refetchAttractions();
      setOpeningAll(false);
      return;
    }

    const performer = displayName || userEmail;
    try {
    for (const a of [...rides, ...shows]) {
      if (a.status !== 'OPEN') {
        await logAudit({
          actionType: 'status_change',
          attractionId: a.id,
          attractionName: a.name,
          performedBy: performer,
          oldValue: a.status,
          newValue: 'OPEN',
          details: 'Bulk open all attractions',
        });
        await logStatusChange({
          attractionId: a.id,
          status: 'OPEN',
          previousStatus: a.status as AttractionStatus,
          changedBy: performer,
        });
        if (a.status === 'DELAYED') {
          await resolveDelay(a.id);
        }
      }
    }
    for (const ride of rides) {
      if (ride.status !== 'OPEN' || ride.wait_time !== 5) {
        await logAudit({
          actionType: 'queue_time_change',
          attractionId: ride.id,
          attractionName: ride.name,
          performedBy: performer,
          oldValue: String(ride.wait_time),
          newValue: '5',
          details: `Wait time reset to 5min (was ${ride.wait_time}min)`,
        });
      }
    }
    } catch (e) {
      console.error('Audit logging failed:', e);
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
    const { error } = await supabase
      .from('park_settings')
      .upsert({ key: 'auto_sort_by_wait', value: String(newValue), updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) {
      console.error('Auto-sort toggle failed:', error);
      setAutoSort(!newValue); // revert optimistic state
      pushToast('error', 'Failed to update auto-sort setting');
    }
  }

  async function handleMoveAttraction(id: string, direction: 'up' | 'down') {
    const idx = attractions.findIndex((a) => a.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= attractions.length) return;

    const current = attractions[idx];
    const swap = attractions[swapIdx];

    // Swap sort_order values
    let failedCount = 0;
    try {
      const results = await Promise.all([
        supabase.from('attractions').update({ sort_order: swap.sort_order, updated_at: new Date().toISOString() }).eq('id', current.id),
        supabase.from('attractions').update({ sort_order: current.sort_order, updated_at: new Date().toISOString() }).eq('id', swap.id),
      ]);
      failedCount = results.filter((r) => r.error).length;
    } catch (e) {
      console.error('Reorder failed:', e);
      failedCount = 2;
    }
    if (failedCount > 0) {
      pushToast('error', `Reorder failed (${failedCount} of 2 updates)`);
      await refetchAttractions();
      return;
    }

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
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: surface.page }}>
        <div style={{ color: textTok.secondary, fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: surface.page }}>
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
        onConfirm={() => deleteTarget && handleDeleteAttraction(deleteTarget.id, deleteTarget.name)}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Delay Reason Modal */}
      <DelayReasonModal
        open={!!delayModal}
        attractionName={delayModal?.attractionName || ''}
        onConfirm={handleDelayConfirm}
        onCancel={() => setDelayModal(null)}
      />

      <AdminNav userEmail={userEmail} displayName={displayName} onLogout={handleLogout} />

      <main style={{ padding: '24px 20px' }}>
      {/* Quick Actions + Operating Hours */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2" style={{ marginBottom: 32 }}>

        {/* Quick Actions card */}
        <div style={{ ...card(), padding: '20px 20px' }}>
          <p style={{ ...microLabel, margin: '0 0 14px' }}>Quick Actions</p>

          {/* Open / Close */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <button onClick={() => setShowOpenAll(true)} disabled={openingAll}
              className="btn-quick"
              style={{ flex: 1, padding: '12px 8px', background: '#22C55E', color: '#000', fontWeight: 700, fontSize: 13, borderRadius: 8, border: 'none', cursor: 'pointer', opacity: openingAll ? 0.5 : 1 }}>
              {openingAll ? 'Opening…' : 'Open All'}
            </button>
            <button onClick={() => setShowCloseAll(true)} disabled={closingAll}
              className="btn-quick"
              style={{ flex: 1, padding: '12px 8px', background: accents.admin.strong, color: '#fff', fontWeight: 700, fontSize: 13, borderRadius: 8, border: 'none', cursor: 'pointer', opacity: closingAll ? 0.5 : 1 }}>
              {closingAll ? 'Closing…' : 'Close All'}
            </button>
          </div>

          {/* Auto-sort */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 12, borderTop: `1px solid ${border.divider}`, marginBottom: 14 }}>
            <button onClick={handleToggleAutoSort}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${autoSort ? 'bg-[#22C55E]' : 'bg-[#181D24] border border-[#2E3543]'}`}>
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${autoSort ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span style={{ color: textTok.secondary, fontSize: 13 }}>
              Auto-sort {autoSort ? <span style={{ color: '#22C55E', fontWeight: 600 }}>ON</span> : <span style={{ color: textTok.muted }}>OFF</span>}
            </span>
          </div>

          {/* Target Dispatch Interval */}
          {(() => {
            const rides = attractions.filter((a) => a.attraction_type !== 'show');
            if (rides.length === 0) return null;
            const uniqueTargets = [...new Set(rides.map((r) => r.target_dispatch_seconds ?? 90))];
            const currentBulk = uniqueTargets.length === 1 ? uniqueTargets[0] : null;
            return (
              <div style={{ paddingTop: 12, borderTop: `1px solid ${border.divider}` }}>
                <p style={{ color: textTok.secondary, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Target Dispatch</p>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[45, 60, 90, 120].map((secs) => (
                    <button key={secs}
                      onClick={async () => {
                        const ids = rides.map((r) => r.id);
                        let failed = 0;
                        for (const id of ids) {
                          try {
                            const { error } = await supabase.from('attractions').update({ target_dispatch_seconds: secs }).eq('id', id);
                            if (error) failed++;
                          } catch {
                            failed++;
                          }
                        }
                        if (failed > 0) {
                          pushToast('error', `Failed to set target dispatch on ${failed} of ${ids.length} rides`);
                          await refetchAttractions();
                        }
                      }}
                      style={{
                        flex: 1, padding: '9px 4px', borderRadius: 7, border: '1px solid',
                        borderColor: currentBulk === secs ? accents.admin.base : border.strong,
                        background: currentBulk === secs ? accents.admin.soft : surface.control,
                        color: currentBulk === secs ? accents.admin.text : textTok.muted,
                        fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                      {secs}s
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        <OperatingHoursControl openingTime={openingTime} closingTime={closingTime} onUpdateOpening={handleOpeningTimeUpdate} onUpdateClosing={handleClosingTimeUpdate} />
      </div>

      {/* ── Sign-off completion banners ── */}
      {(() => {
        const rides = attractions.filter((a) => a.attraction_type !== 'show');
        if (rides.length === 0 || signoffStatuses.size === 0) return null;

        const allOpeningSigned = rides.every((a) => {
          const s = signoffStatuses.get(a.id);
          return s && s.openingTotal > 0 && s.openingCompleted === s.openingTotal;
        });
        const allClosingSigned = rides.every((a) => {
          const s = signoffStatuses.get(a.id);
          return s && s.closingTotal > 0 && s.closingCompleted === s.closingTotal;
        });

        if (!allOpeningSigned && !allClosingSigned) return null;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {allOpeningSigned && (
              <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="#22C55E" strokeWidth="1.5"/>
                  <path d="M5 8L7 10L11 6" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ color: '#22C55E', fontSize: 14, fontWeight: 600 }}>All Opening Sign-Offs Complete</span>
                <span style={{ color: '#22C55E', opacity: 0.6, fontSize: 13 }}>— All {rides.length} attractions signed off for opening</span>
              </div>
            )}
            {allClosingSigned && (
              <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="#22C55E" strokeWidth="1.5"/>
                  <path d="M5 8L7 10L11 6" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ color: '#22C55E', fontSize: 14, fontWeight: 600 }}>All Closing Sign-Offs Complete</span>
                <span style={{ color: '#22C55E', opacity: 0.6, fontSize: 13 }}>— All {rides.length} attractions signed off for closing</span>
              </div>
            )}
          </div>
        );
      })()}

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
              signoffStatus={signoffStatuses.get(attraction.id)}
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
              signoffStatus={signoffStatuses.get(attraction.id)}
            />
          )
        )}
      </div>
      </main>

      <ToastStack toasts={toasts} />
    </div>
  );
}
