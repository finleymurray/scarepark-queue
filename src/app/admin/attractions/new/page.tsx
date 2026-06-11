'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkAuth, clearAuthCache } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import AdminNav from '@/components/AdminNav';
import type { AttractionType } from '@/types/database';
import { surface, border, text, radius } from '@/lib/theme';
import { InlineError } from '@/components/ui/Toast';

const MAX_ASSET_BYTES = 10 * 1024 * 1024; // 10 MB per file

interface NewAttractionPayload {
  name: string;
  slug: string;
  type: AttractionType;
  targetDispatchSeconds: number;
  showTimes: string[];
  logoFile: File | null;
  bgFile: File | null;
  queueBgFile: File | null;
  glowHex: string | null;
  textColorHex: string | null;
  fearRating: number | null;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function hexToRgbString(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

/* File drop zone with preview */
function AssetDropZone({
  label,
  hint,
  file,
  onSelect,
}: {
  label: string;
  hint?: string;
  file: File | null;
  onSelect: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState('');

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handlePick(f: File | null) {
    if (f && f.size > MAX_ASSET_BYTES) {
      setSizeError(`"${f.name}" is ${(f.size / (1024 * 1024)).toFixed(1)} MB — the limit is 10 MB per file. Please choose a smaller image.`);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setSizeError('');
    onSelect(f);
  }

  return (
    <div>
      <label className="block text-[#94A3B8] text-xs font-semibold mb-1" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
      {hint && <p className="text-[#475569] text-[11px] mb-1.5">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => handlePick(e.target.files?.[0] ?? null)}
      />
      {sizeError && <div className="mb-1.5"><InlineError message={sizeError} /></div>}
      {file ? (
        <div className="flex items-center gap-3 p-3 bg-[#13161C] border border-[#23262E] rounded-md">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="rounded object-contain bg-[#181D24]" style={{ width: 56, height: 56 }} />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[#F1F5F9] text-xs truncate">{file.name}</p>
            <p className="text-[#475569] text-[11px]">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
          <button
            type="button"
            onClick={() => { handlePick(null); if (inputRef.current) inputRef.current.value = ''; }}
            className="text-[#EF4444] text-xs font-semibold px-2 py-1 rounded hover:bg-[#7f1d1d]/30"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full py-5 bg-[#13161C] border border-dashed border-[#23262E] rounded-md text-[#475569] text-xs
                     hover:border-[#3B82F6] hover:text-[#94A3B8] transition-colors focus:outline-none focus:border-[#3B82F6]"
        >
          Click to choose an image
        </button>
      )}
    </div>
  );
}

const WIZARD_STEPS_RIDE = ['Basics', 'Artwork', 'Theming', 'Review'];
const WIZARD_STEPS_SHOW = ['Basics', 'Artwork', 'Theming', 'Show Times'];

function ReviewSummary({
  name, type, slug, logoFile, bgFile, queueBgFile, glowHex, textHex, fearRating, showTimes, targetDispatch,
}: {
  name: string; type: AttractionType; slug: string;
  logoFile: File | null; bgFile: File | null; queueBgFile: File | null;
  glowHex: string | null; textHex: string | null; fearRating: number | null;
  showTimes: string[]; targetDispatch: number;
}) {
  const assets = [logoFile && 'Logo', bgFile && 'Background', queueBgFile && 'Queue background'].filter(Boolean);
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="flex justify-between gap-4 py-1.5 border-b border-[#181B21]">
      <span className="text-[#475569] text-xs">{k}</span>
      <span className="text-[#F1F5F9] text-xs text-right">{v}</span>
    </div>
  );
  return (
    <div className="mt-1">
      <h4 className="text-[#94A3B8] text-xs font-semibold mb-2" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Review</h4>
      <Row k="Name" v={name || '—'} />
      <Row k="Type" v={type === 'show' ? 'Live Show' : 'Ride / Maze'} />
      <Row k="Slug" v={slug || '—'} />
      {type === 'ride' && <Row k="Dispatch interval" v={`${targetDispatch}s`} />}
      <Row k="Assets" v={assets.length ? assets.join(', ') : 'None'} />
      <Row k="Glow" v={glowHex ? <span style={{ color: glowHex }}>{glowHex}</span> : 'Default'} />
      <Row k="Queue text" v={textHex ? <span style={{ color: textHex }}>{textHex}</span> : 'Default'} />
      {type === 'ride' && <Row k="Fear rating" v={fearRating ? `${fearRating} 💀` : '—'} />}
      {type === 'show' && <Row k="Show times" v={showTimes.length ? showTimes.join(', ') : 'None'} />}
    </div>
  );
}

/** Phase 1 — slug collision check BEFORE any uploads. Returns the next sort_order. */
async function checkSlugAndGetOrder(slug: string): Promise<number> {
  const { data: existing } = await supabase
    .from('attractions')
    .select('slug,sort_order');

  if (existing?.some((a) => a.slug === slug)) {
    throw new Error(`An attraction with the slug "${slug}" already exists. Choose a different name.`);
  }

  const orders = (existing || []).map((a) => a.sort_order).filter((n): n is number => typeof n === 'number');
  return orders.length > 0 ? Math.max(...orders) + 1 : 1;
}

/** Phase 2 — upload a single asset to Supabase Storage and return its public URL. */
async function uploadAsset(slug: string, file: File, kind: string): Promise<string> {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `${slug}/${kind}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from('attraction-assets')
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (upErr) {
    if (process.env.NODE_ENV === 'development') console.error('Asset upload failed:', upErr);
    throw new Error(`Failed to upload ${kind} image.`);
  }
  return supabase.storage.from('attraction-assets').getPublicUrl(path).data.publicUrl;
}

/** Phase 3 — insert the attraction row (assets already uploaded). */
async function insertAttraction(
  payload: NewAttractionPayload,
  performer: string,
  nextOrder: number,
  logoUrl: string | null,
  bgUrl: string | null,
  queueBgUrl: string | null,
) {
  const { name, slug, type } = payload;

  const { data, error } = await supabase
    .from('attractions')
    .insert({
      name,
      slug,
      status: 'CLOSED',
      wait_time: 0,
      sort_order: nextOrder,
      attraction_type: type,
      show_times: type === 'show' ? payload.showTimes : [],
      target_dispatch_seconds: type === 'ride' ? payload.targetDispatchSeconds : null,
      logo_url: logoUrl,
      bg_url: bgUrl,
      queue_bg_url: queueBgUrl,
      glow_rgb: payload.glowHex ? hexToRgbString(payload.glowHex) : null,
      text_color: payload.textColorHex,
      text_rgb: payload.textColorHex ? hexToRgbString(payload.textColorHex).replace(/\s/g, '') : null,
      fear_rating: payload.fearRating,
    })
    .select('id')
    .single();

  if (error) {
    if (process.env.NODE_ENV === 'development') console.error('Error adding attraction:', error);
    if (error.code === '23505') {
      throw new Error(`An attraction with the slug "${slug}" already exists. Choose a different name.`);
    }
    throw new Error('Failed to add attraction. Please try again.');
  }

  logAudit({
    actionType: 'attraction_created',
    attractionId: data.id,
    attractionName: name,
    performedBy: performer,
    newValue: type === 'show' ? 'Show' : 'Ride',
  });
}

function NewAttractionWizard({ onCreated, performer }: { onCreated: () => void; performer: string }) {
  const [step, setStep] = useState(0);
  const [type, setType] = useState<AttractionType>('ride');
  const [name, setName] = useState('');
  const [targetDispatch, setTargetDispatch] = useState(90);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [queueBgFile, setQueueBgFile] = useState<File | null>(null);
  const [glowHex, setGlowHex] = useState('#a855f7');
  const [glowEnabled, setGlowEnabled] = useState(false);
  const [textHex, setTextHex] = useState('#fbbf24');
  const [textEnabled, setTextEnabled] = useState(false);
  const [fearRating, setFearRating] = useState<number | null>(null);
  const [showTimes, setShowTimes] = useState<string[]>([]);
  const [newShowTime, setNewShowTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitLabel, setSubmitLabel] = useState('');
  const [error, setError] = useState('');
  const [failedAsset, setFailedAsset] = useState<string | null>(null);

  // Uploaded asset URLs are cached so a retry after a failed upload doesn't
  // re-upload assets that already succeeded.
  const uploadedUrls = useRef<Record<string, string | null>>({});
  useEffect(() => { delete uploadedUrls.current['logo']; }, [logoFile]);
  useEffect(() => { delete uploadedUrls.current['bg']; }, [bgFile]);
  useEffect(() => { delete uploadedUrls.current['queue-bg']; }, [queueBgFile]);

  const steps = type === 'show' ? WIZARD_STEPS_SHOW : WIZARD_STEPS_RIDE;
  const slug = slugify(name);
  // Slug change invalidates all cached uploads (storage paths include the slug)
  useEffect(() => { uploadedUrls.current = {}; }, [slug]);
  const isLastStep = step === steps.length - 1;
  const canProceed = step === 0 ? name.trim().length > 0 : true;

  // logo preview for theming step
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!logoFile) { setLogoPreview(null); return; }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  function addShowTime() {
    const t = newShowTime.trim();
    if (!/^\d{2}:\d{2}$/.test(t)) return;
    if (showTimes.includes(t)) { setNewShowTime(''); return; }
    setShowTimes([...showTimes, t].sort());
    setNewShowTime('');
  }

  async function handleSubmit() {
    if (!name.trim()) return;
    setSubmitting(true);
    setError('');
    setFailedAsset(null);
    try {
      // 1. Check slug availability BEFORE uploading any files
      setSubmitLabel('Checking name…');
      const nextOrder = await checkSlugAndGetOrder(slug);

      // 2. Upload each asset individually (skipping any already uploaded)
      const assets: { kind: string; label: string; file: File | null }[] = [
        { kind: 'logo', label: 'logo', file: logoFile },
        { kind: 'bg', label: 'background', file: bgFile },
        { kind: 'queue-bg', label: 'queue background', file: queueBgFile },
      ];
      for (const asset of assets) {
        if (!asset.file || uploadedUrls.current[asset.kind] !== undefined) continue;
        setSubmitLabel(`Uploading ${asset.label}…`);
        try {
          uploadedUrls.current[asset.kind] = await uploadAsset(slug, asset.file, asset.kind);
        } catch {
          setFailedAsset(asset.label);
          setError(`Failed to upload the ${asset.label} image. Your other progress is saved — retry just this upload.`);
          setSubmitting(false);
          setSubmitLabel('');
          return;
        }
      }

      // 3. Insert the attraction row
      setSubmitLabel('Creating attraction…');
      await insertAttraction({
        name: name.trim(),
        slug,
        type,
        targetDispatchSeconds: targetDispatch,
        showTimes: type === 'show' ? showTimes : [],
        logoFile,
        bgFile,
        queueBgFile,
        glowHex: glowEnabled ? glowHex : null,
        textColorHex: textEnabled ? textHex : null,
        fearRating: type === 'ride' ? fearRating : null,
      }, performer, nextOrder,
        uploadedUrls.current['logo'] ?? null,
        uploadedUrls.current['bg'] ?? null,
        uploadedUrls.current['queue-bg'] ?? null,
      );
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create attraction');
      setSubmitting(false);
      setSubmitLabel('');
    }
  }

  return (
    <div style={{ background: surface.card, border: `1px solid ${border.default}`, borderRadius: radius.xl, display: 'flex', flexDirection: 'column' }}>
      {/* Header / step indicator */}
      <div style={{ padding: '20px 24px', borderBottom: `1px solid ${border.divider}` }}>
        <div className="flex items-center gap-2">
          {steps.map((label, i) => (
            <div key={label} className="flex-1 flex flex-col gap-1">
              <div style={{ height: 3, borderRadius: 2, background: i <= step ? '#2563EB' : border.strong }} />
              <span className="text-[10px]" style={{ color: i === step ? '#F1F5F9' : '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
            </div>
          ))}
        </div>
        <p className="text-[#475569] text-[11px] mt-2">Step {step + 1} of {steps.length}</p>
      </div>

      {/* Body */}
      <div style={{ padding: 24 }}>
        {/* Step 1 — Basics */}
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-[#94A3B8] text-xs font-semibold mb-1.5" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Type</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setType('ride')}
                  className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors border ${type === 'ride' ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-transparent text-[#94A3B8] border-[#2E3543]'}`}
                >Ride / Maze</button>
                <button
                  onClick={() => setType('show')}
                  className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors border ${type === 'show' ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-transparent text-[#94A3B8] border-[#2E3543]'}`}
                >Live Show</button>
              </div>
            </div>

            <div>
              <label className="block text-[#94A3B8] text-xs font-semibold mb-1.5" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Name</label>
              <input
                type="text"
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                placeholder={type === 'ride' ? 'Ride name' : 'Show name'}
                className="w-full px-3 py-2 bg-[#13161C] border border-[#23262E] rounded-md text-[#F1F5F9] text-sm placeholder-[#475569] focus:outline-none focus:border-[#3B82F6] transition-colors"
              />
              {slug && <p className="text-[#475569] text-[11px] mt-1.5">Slug: <span className="text-[#94A3B8]">{slug}</span></p>}
            </div>

            {type === 'ride' && (
              <div>
                <label className="block text-[#94A3B8] text-xs font-semibold mb-1.5" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Target dispatch interval (seconds)</label>
                <div className="flex gap-2 mb-2">
                  {[45, 60, 90, 120].map((s) => (
                    <button
                      key={s}
                      onClick={() => setTargetDispatch(s)}
                      className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors border ${targetDispatch === s ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-transparent text-[#94A3B8] border-[#2E3543]'}`}
                    >{s}</button>
                  ))}
                </div>
                <input
                  type="number"
                  value={targetDispatch}
                  min={1}
                  onChange={(e) => setTargetDispatch(Math.max(1, parseInt(e.target.value || '0', 10)))}
                  className="w-full px-3 py-2 bg-[#13161C] border border-[#23262E] rounded-md text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors"
                />
              </div>
            )}
          </div>
        )}

        {/* Step 2 — Artwork */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <p className="text-[#475569] text-[11px]">All images optional. PNG, JPG, WebP or SVG · max 10 MB each.</p>
            <AssetDropZone
              label="Logo image"
              hint="Transparent PNG or WebP · square, ~1000 × 1000 px"
              file={logoFile}
              onSelect={setLogoFile}
            />
            <AssetDropZone
              label="Background image (TV banners)"
              hint="Landscape · 1920 × 1080 px (16:9)"
              file={bgFile}
              onSelect={setBgFile}
            />
            <AssetDropZone
              label="Queue display background (optional)"
              hint="Portrait · 1080 × 1920 px (9:16) for entrance screens"
              file={queueBgFile}
              onSelect={setQueueBgFile}
            />
          </div>
        )}

        {/* Step 3 — Theming */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div>
              <label className="flex items-center gap-2 text-[#94A3B8] text-xs font-semibold mb-2" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <input type="checkbox" checked={glowEnabled} onChange={(e) => setGlowEnabled(e.target.checked)} />
                Glow colour
              </label>
              {glowEnabled && (
                <div className="flex items-center gap-3">
                  <input type="color" value={glowHex} onChange={(e) => setGlowHex(e.target.value)} className="w-12 h-10 rounded bg-transparent border border-[#2E3543] cursor-pointer" />
                  <span className="text-[#94A3B8] text-xs">{hexToRgbString(glowHex)}</span>
                  {logoPreview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoPreview} alt="" className="object-contain ml-auto" style={{ width: 64, height: 64, filter: `drop-shadow(0 0 8px rgba(${hexToRgbString(glowHex)}, 0.7)) drop-shadow(0 0 20px rgba(${hexToRgbString(glowHex)}, 0.4))` }} />
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="flex items-center gap-2 text-[#94A3B8] text-xs font-semibold mb-2" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <input type="checkbox" checked={textEnabled} onChange={(e) => setTextEnabled(e.target.checked)} />
                Queue text colour
              </label>
              {textEnabled && (
                <div className="flex items-center gap-3">
                  <input type="color" value={textHex} onChange={(e) => setTextHex(e.target.value)} className="w-12 h-10 rounded bg-transparent border border-[#2E3543] cursor-pointer" />
                  <span className="text-sm font-bold" style={{ color: textHex }}>Sample text</span>
                </div>
              )}
            </div>

            {type === 'ride' && (
              <div>
                <label className="block text-[#94A3B8] text-xs font-semibold mb-2" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fear rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      onClick={() => setFearRating(fearRating === n ? null : n)}
                      className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors border ${fearRating === n ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-transparent text-[#94A3B8] border-[#2E3543]'}`}
                      aria-pressed={fearRating === n}
                    >💀 {n}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4 — Show Times (shows) / Review (rides) */}
        {step === 3 && type === 'show' && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-[#94A3B8] text-xs font-semibold mb-1.5" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Show times</label>
              <div className="flex gap-2">
                <input
                  type="time"
                  value={newShowTime}
                  onChange={(e) => setNewShowTime(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addShowTime(); } }}
                  className="flex-1 px-3 py-2 bg-[#13161C] border border-[#23262E] rounded-md text-[#F1F5F9] text-sm focus:outline-none focus:border-[#3B82F6] transition-colors"
                />
                <button onClick={addShowTime} className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold rounded-md transition-colors">Add</button>
              </div>
              {showTimes.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {showTimes.map((t) => (
                    <span key={t} className="flex items-center gap-1.5 px-2.5 py-1 bg-[#13161C] border border-[#23262E] rounded-md text-[#F1F5F9] text-xs">
                      {t}
                      <button onClick={() => setShowTimes(showTimes.filter((x) => x !== t))} className="text-[#EF4444] font-bold">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <ReviewSummary name={name} type={type} slug={slug} logoFile={logoFile} bgFile={bgFile} queueBgFile={queueBgFile} glowHex={glowEnabled ? glowHex : null} textHex={textEnabled ? textHex : null} fearRating={null} showTimes={showTimes} targetDispatch={targetDispatch} />
          </div>
        )}

        {step === 3 && type === 'ride' && (
          <ReviewSummary name={name} type={type} slug={slug} logoFile={logoFile} bgFile={bgFile} queueBgFile={queueBgFile} glowHex={glowEnabled ? glowHex : null} textHex={textEnabled ? textHex : null} fearRating={fearRating} showTimes={[]} targetDispatch={targetDispatch} />
        )}

        {error && (
          <div className="mt-4 flex flex-col gap-2">
            <InlineError message={error} />
            {failedAsset && (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="self-center px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-md transition-colors disabled:opacity-40"
              >
                Retry upload
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer / nav */}
      <div style={{ padding: '16px 24px', borderTop: `1px solid ${border.divider}` }} className="flex items-center justify-between gap-3">
        <button
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={submitting || step === 0}
          className="px-4 py-2 bg-transparent border border-[#2E3543] text-[#94A3B8] text-sm font-semibold rounded-md hover:text-[#F8FAFC] transition-colors disabled:opacity-30"
        >Back</button>

        {isLastStep ? (
          <button
            onClick={handleSubmit}
            disabled={submitting || !name.trim()}
            className="btn-quick px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >{submitting ? (submitLabel || 'Creating…') : 'Create Attraction'}</button>
        ) : (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed}
            className="btn-quick px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >Next</button>
        )}
      </div>
    </div>
  );
}

export default function NewAttractionPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const auth = await checkAuth();
      if (!auth.authenticated || auth.role !== 'admin') {
        window.location.href = '/login';
        return;
      }
      setUserEmail(auth.email || '');
      setDisplayName(auth.displayName || '');
      setLoading(false);
    }
    init();
  }, [router]);

  async function handleLogout() {
    clearAuthCache(); await supabase.auth.signOut();
    window.location.href = '/login';
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: surface.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-white text-xl font-semibold animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: surface.page, color: text.primary }}>
      <AdminNav userEmail={userEmail} displayName={displayName} onLogout={handleLogout} />

      <div style={{ maxWidth: 620, margin: '0 auto', padding: '32px 20px' }}>
        <a href="/admin" style={{ color: '#94A3B8', fontSize: 13, textDecoration: 'none' }}>← Attractions</a>
        <h2 className="text-2xl font-bold" style={{ margin: '12px 0 24px' }}>New Attraction</h2>
        <NewAttractionWizard
          performer={displayName || userEmail}
          onCreated={() => window.location.href = '/admin'}
        />
      </div>
    </div>
  );
}
