'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { checkAuth, clearAuthCache } from '@/lib/auth';
import AdminNav from '@/components/AdminNav';
import type { Attraction, AttractionType } from '@/types/database';
import { surface, border, text as textTok, radius, microLabel } from '@/lib/theme';
import { useToasts, ToastStack } from '@/components/ui/Toast';

const MAX_ASSET_BYTES = 10 * 1024 * 1024; // 10 MB per file

/* ── helpers ── */

const FIELD_LABEL: React.CSSProperties = {
  display: 'block',
  color: '#94A3B8',
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 6,
};

const INPUT_CLASS =
  'w-full px-3 py-2 bg-[#13161C] border border-[#23262E] rounded-md text-[#F1F5F9] text-sm placeholder-[#475569] focus:outline-none focus:border-[#3B82F6] transition-colors';

/** Validates a loose "R, G, B" string; returns normalised "r, g, b" or null if invalid. */
function parseRgbString(value: string): string | null {
  const parts = value.split(',').map((p) => p.trim());
  if (parts.length !== 3) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? parseInt(p, 10) : NaN));
  if (nums.some((n) => isNaN(n) || n < 0 || n > 255)) return null;
  return nums.join(', ');
}

function isValidHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

/* ── Field wrappers ── */

/** Text input that saves on blur (only when the value actually changed). */
function AutoSaveText({
  label,
  value,
  placeholder,
  helper,
  type = 'text',
  onSave,
}: {
  label: string;
  value: string;
  placeholder?: string;
  helper?: string;
  type?: 'text' | 'number';
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <div>
      <label style={FIELD_LABEL}>{label}</label>
      <input
        type={type}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if (draft !== value) onSave(draft); }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className={INPUT_CLASS}
      />
      {helper && <p className="text-[#475569] text-[11px] mt-1.5">{helper}</p>}
    </div>
  );
}

/** "R, G, B" input with a live colour swatch. Saves on blur; rejects bad input. */
function RgbField({
  label,
  value,
  helper,
  onSave,
  onInvalid,
}: {
  label: string;
  value: string;
  helper?: string;
  onSave: (normalised: string | null) => void;
  onInvalid: () => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const parsed = parseRgbString(draft);

  function handleBlur() {
    if (draft.trim() === '' && value !== '') { onSave(null); return; }
    if (draft === value || draft.trim() === '') return;
    if (!parsed) { onInvalid(); setDraft(value); return; }
    if (parsed !== value) onSave(parsed);
  }

  return (
    <div>
      <label style={FIELD_LABEL}>{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={draft}
          placeholder="168, 85, 247"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          className={INPUT_CLASS}
          style={{ flex: 1 }}
        />
        <span
          aria-hidden
          style={{
            width: 36, height: 36, flexShrink: 0, borderRadius: radius.sm,
            border: `1px solid ${border.strong}`,
            background: parsed ? `rgb(${parsed})` : surface.control,
          }}
        />
      </div>
      {helper && <p className="text-[#475569] text-[11px] mt-1.5">{helper}</p>}
    </div>
  );
}

/* ── Asset re-upload ── */

const ASSET_KINDS = [
  { kind: 'logo', column: 'logo_url', label: 'Logo image', hint: 'Transparent PNG or WebP · square, ~1000 × 1000 px' },
  { kind: 'bg', column: 'bg_url', label: 'Background image (TV banners)', hint: 'Landscape · 1920 × 1080 px (16:9)' },
  { kind: 'queue-bg', column: 'queue_bg_url', label: 'Queue display background', hint: 'Portrait · 1080 × 1920 px (9:16) for entrance screens' },
] as const;

type AssetColumn = (typeof ASSET_KINDS)[number]['column'];

function AssetUploader({
  label,
  hint,
  currentUrl,
  uploading,
  onPick,
}: {
  label: string;
  hint: string;
  currentUrl: string | null;
  uploading: boolean;
  onPick: (f: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label style={FIELD_LABEL}>{label}</label>
      <p className="text-[#475569] text-[11px] mb-1.5">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          if (inputRef.current) inputRef.current.value = '';
        }}
      />
      <div className="flex items-center gap-3 p-3" style={{ background: surface.control, border: `1px solid ${border.default}`, borderRadius: radius.sm }}>
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentUrl} alt="" className="rounded object-contain bg-[#181D24]" style={{ width: 56, height: 56, flexShrink: 0 }} />
        ) : (
          <div className="flex items-center justify-center rounded bg-[#181D24] text-[#475569] text-[10px]" style={{ width: 56, height: 56, flexShrink: 0 }}>
            None
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[#94A3B8] text-xs truncate">{currentUrl ? 'Current image' : 'No image set'}</p>
          <p className="text-[#475569] text-[11px]">PNG, JPG, WebP or SVG · max 10 MB</p>
        </div>
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="px-3 py-1.5 text-xs font-semibold rounded-md transition-colors disabled:opacity-40"
          style={{ background: surface.raised, border: `1px solid ${border.strong}`, color: textTok.secondary, cursor: uploading ? 'wait' : 'pointer' }}
        >
          {uploading ? 'Uploading…' : currentUrl ? 'Replace' : 'Upload'}
        </button>
      </div>
    </div>
  );
}

/* ── Edit panel (expanded card body) ── */

function AttractionEditPanel({
  attraction,
  performer,
  onUpdated,
  pushToast,
}: {
  attraction: Attraction;
  performer: string;
  onUpdated: (id: string, updates: Partial<Attraction>) => void;
  pushToast: (kind: 'error' | 'success', message: string) => void;
}) {
  const [uploadingKind, setUploadingKind] = useState<string | null>(null);

  /** Save one or more columns, audit the change, refresh local state, toast the result. */
  const saveFields = useCallback(
    async (updates: Partial<Attraction>, fieldLabel: string, oldValue: string | null, newValue: string | null) => {
      const { error } = await supabase.from('attractions').update(updates).eq('id', attraction.id);
      if (error) {
        if (process.env.NODE_ENV === 'development') console.error('Attraction update failed:', error);
        pushToast('error', `Failed to save ${fieldLabel.toLowerCase()}`);
        return false;
      }
      onUpdated(attraction.id, updates);
      pushToast('success', fieldLabel);

      // Audit trail — the AuditActionType union has no attraction-edit member, so
      // insert directly (same column pattern as screens/page.tsx 'screen_assigned').
      const { error: auditError } = await supabase.from('audit_logs').insert({
        action_type: 'attraction_updated',
        attraction_id: attraction.id,
        attraction_name: attraction.name,
        performed_by: performer,
        old_value: oldValue,
        new_value: newValue,
        details: `${fieldLabel} updated`,
      });
      if (auditError && process.env.NODE_ENV === 'development') {
        console.error('Audit log error:', auditError);
      }
      return true;
    },
    [attraction.id, attraction.name, performer, onUpdated, pushToast],
  );

  async function handleAssetUpload(kind: string, column: AssetColumn, label: string, file: File) {
    if (file.size > MAX_ASSET_BYTES) {
      pushToast('error', `"${file.name}" is over the 10 MB limit`);
      return;
    }
    setUploadingKind(kind);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `${attraction.slug}/${kind}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('attraction-assets')
        .upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (upErr) {
        if (process.env.NODE_ENV === 'development') console.error('Asset upload failed:', upErr);
        pushToast('error', `Failed to upload ${label.toLowerCase()}`);
        return;
      }
      // Cache-bust so the new image shows immediately even when the path is unchanged
      const publicUrl = supabase.storage.from('attraction-assets').getPublicUrl(path).data.publicUrl;
      const url = `${publicUrl}?v=${Date.now()}`;
      await saveFields({ [column]: url } as Partial<Attraction>, label, attraction[column] ?? null, url);
    } finally {
      setUploadingKind(null);
    }
  }

  const glowValue = attraction.glow_rgb ?? '';
  const textRgbValue = attraction.text_rgb ?? '';

  return (
    <div style={{ borderTop: `1px solid ${border.divider}`, padding: '20px 20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Identity */}
      <AutoSaveText
        label="Display name"
        value={attraction.name}
        placeholder="Attraction name"
        onSave={(v) => {
          const name = v.trim();
          if (!name) { pushToast('error', 'Name cannot be empty'); return; }
          saveFields({ name }, 'Display name', attraction.name, name);
        }}
      />

      <AutoSaveText
        label="Tagline"
        value={attraction.tagline ?? ''}
        placeholder="One-line hook shown on TV screens…"
        onSave={(v) => {
          const tagline = v.trim() || null;
          saveFields({ tagline }, 'Tagline', attraction.tagline ?? null, tagline);
        }}
      />

      {/* Slug — read-only */}
      <div>
        <label style={FIELD_LABEL}>Slug</label>
        <div className="px-3 py-2 text-sm" style={{ background: surface.control, border: `1px solid ${border.default}`, borderRadius: radius.sm, color: textTok.muted }}>
          {attraction.slug}
        </div>
        <p className="text-[#475569] text-[11px] mt-1.5">Read-only — changing the slug would break screen assignments and asset paths.</p>
      </div>

      {/* Type */}
      <div>
        <label style={FIELD_LABEL}>Attraction type</label>
        <div className="flex gap-2">
          {(['ride', 'show'] as AttractionType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                if (t === attraction.attraction_type) return;
                saveFields({ attraction_type: t }, 'Attraction type', attraction.attraction_type, t);
              }}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors border ${attraction.attraction_type === t ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-transparent text-[#94A3B8] border-[#2E3543]'}`}
            >
              {t === 'ride' ? 'Ride / Maze' : 'Live Show'}
            </button>
          ))}
        </div>
      </div>

      {/* Dispatch */}
      {attraction.attraction_type === 'ride' && (
        <AutoSaveText
          label="Target dispatch interval (seconds)"
          type="number"
          value={attraction.target_dispatch_seconds != null ? String(attraction.target_dispatch_seconds) : ''}
          placeholder="90"
          onSave={(v) => {
            const n = parseInt(v, 10);
            if (v.trim() === '' || isNaN(n) || n < 1) { pushToast('error', 'Dispatch interval must be a positive number'); return; }
            saveFields(
              { target_dispatch_seconds: n },
              'Dispatch interval',
              attraction.target_dispatch_seconds != null ? String(attraction.target_dispatch_seconds) : null,
              String(n),
            );
          }}
        />
      )}

      {/* Theming */}
      <RgbField
        label="Glow colour (R, G, B)"
        value={glowValue}
        helper="Used for TV screens & app theming. Leave blank to use the default."
        onSave={(rgb) => saveFields({ glow_rgb: rgb }, 'Glow colour', attraction.glow_rgb ?? null, rgb)}
        onInvalid={() => pushToast('error', 'Glow colour must be "R, G, B" with values 0–255')}
      />

      <div>
        <label style={FIELD_LABEL}>Queue text colour</label>
        <div className="flex flex-col gap-3">
          <HexField
            value={attraction.text_color ?? ''}
            onSave={(hex) => saveFields({ text_color: hex }, 'Queue text colour (hex)', attraction.text_color ?? null, hex)}
            onInvalid={() => pushToast('error', 'Hex colour must look like #fbbf24')}
          />
          <RgbField
            label="Queue text RGB (R, G, B)"
            value={textRgbValue}
            helper="Stored alongside the hex for rgba() theming. Keep the two in sync."
            onSave={(rgb) => saveFields(
              { text_rgb: rgb ? rgb.replace(/\s/g, '') : null },
              'Queue text RGB',
              attraction.text_rgb ?? null,
              rgb ? rgb.replace(/\s/g, '') : null,
            )}
            onInvalid={() => pushToast('error', 'Queue text RGB must be "R, G, B" with values 0–255')}
          />
        </div>
      </div>

      {/* Assets */}
      <div style={{ borderTop: `1px solid ${border.divider}`, paddingTop: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <span style={microLabel}>Artwork</span>
        {ASSET_KINDS.map(({ kind, column, label, hint }) => (
          <AssetUploader
            key={kind}
            label={label}
            hint={hint}
            currentUrl={attraction[column] ?? null}
            uploading={uploadingKind === kind}
            onPick={(f) => handleAssetUpload(kind, column, label, f)}
          />
        ))}
      </div>

      <p className="text-[#475569] text-[11px]">
        Sort order, live status and wait times are managed on the main Attractions tab.
      </p>
    </div>
  );
}

/** Hex colour input with swatch; saves on blur. */
function HexField({
  value,
  onSave,
  onInvalid,
}: {
  value: string;
  onSave: (hex: string | null) => void;
  onInvalid: () => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const valid = isValidHex(draft);

  function handleBlur() {
    const trimmed = draft.trim();
    if (trimmed === '' && value !== '') { onSave(null); return; }
    if (trimmed === value || trimmed === '') return;
    if (!isValidHex(trimmed)) { onInvalid(); setDraft(value); return; }
    onSave(trimmed);
  }

  return (
    <div className="flex items-center gap-3">
      <input
        type="text"
        value={draft}
        placeholder="#fbbf24"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className={INPUT_CLASS}
        style={{ flex: 1 }}
      />
      <span
        aria-hidden
        style={{
          width: 36, height: 36, flexShrink: 0, borderRadius: radius.sm,
          border: `1px solid ${border.strong}`,
          background: valid ? draft : surface.control,
        }}
      />
    </div>
  );
}

/* ── Page ── */

export default function AttractionDetailsPage() {
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toasts, pushToast } = useToasts();

  useEffect(() => {
    async function init() {
      const auth = await checkAuth();
      if (!auth.authenticated || auth.role !== 'admin') {
        window.location.href = '/login';
        return;
      }
      setUserEmail(auth.email || '');
      setDisplayName(auth.displayName || '');

      const { data, error } = await supabase
        .from('attractions')
        .select('id,name,slug,status,wait_time,sort_order,attraction_type,show_times,updated_at,target_dispatch_seconds,logo_url,bg_url,queue_bg_url,glow_rgb,text_color,text_rgb,tagline')
        .order('sort_order', { ascending: true });
      if (error && process.env.NODE_ENV === 'development') console.error('Error fetching attractions:', error);
      setAttractions(data || []);
      setLoading(false);
    }
    init();
  }, []);

  async function handleLogout() {
    clearAuthCache(); await supabase.auth.signOut();
    window.location.href = '/login';
  }

  const handleUpdated = useCallback((id: string, updates: Partial<Attraction>) => {
    setAttractions((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: surface.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-white text-xl font-semibold animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: surface.page, color: textTok.primary }}>
      <AdminNav userEmail={userEmail} displayName={displayName} onLogout={handleLogout} />

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 20px' }}>
        <h2 className="text-2xl font-bold" style={{ margin: '0 0 6px' }}>Attraction Details</h2>
        <p style={{ color: textTok.secondary, fontSize: 13, margin: '0 0 24px' }}>
          Taglines, theming and artwork. Changes save automatically.
        </p>

        {attractions.length === 0 && (
          <div style={{ background: surface.card, border: `1px solid ${border.default}`, borderRadius: radius.xl, padding: 32, textAlign: 'center', color: textTok.muted, fontSize: 14 }}>
            No attractions yet. <a href="/admin/attractions/new" style={{ color: '#93C5FD' }}>Add one</a> to get started.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {attractions.map((a) => {
            const expanded = expandedId === a.id;
            const glowRgb = a.glow_rgb || '148, 163, 184';
            return (
              <div
                key={a.id}
                style={{
                  border: `1px solid ${expanded ? border.strong : border.default}`,
                  borderRadius: radius.xl,
                  overflow: 'hidden',
                  background: `linear-gradient(105deg, rgba(${glowRgb}, 0.12) 0%, ${surface.card} 55%)`,
                  transition: 'border-color 0.15s',
                }}
              >
                {/* Card header — tap to expand */}
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : a.id)}
                  aria-expanded={expanded}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 20px', background: 'transparent', border: 'none',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{ width: 48, height: 48, flexShrink: 0, borderRadius: radius.sm, background: surface.raised, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {a.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span style={{ color: textTok.faint, fontSize: 16, fontWeight: 700 }}>{a.name.charAt(0)}</span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: textTok.primary, fontSize: 15, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</p>
                    <p style={{ color: textTok.faint, fontSize: 12, margin: '2px 0 0' }}>{a.slug}</p>
                  </div>
                  <span style={microLabel}>{a.attraction_type === 'show' ? 'Show' : 'Ride'}</span>
                  <svg width="12" height="12" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, opacity: 0.5, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                    <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {expanded && (
                  <AttractionEditPanel
                    attraction={a}
                    performer={displayName || userEmail}
                    onUpdated={handleUpdated}
                    pushToast={pushToast}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ToastStack toasts={toasts} />
    </div>
  );
}
