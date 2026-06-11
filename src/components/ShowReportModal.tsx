'use client';

import { useEffect, useState, useCallback } from 'react';
import SignatureCanvas from './SignatureCanvas';
import { fetchReportData, getExistingReport, submitShowReport } from '@/lib/showReport';
import { verifyPin } from '@/lib/signoff';
import { surface, border, text, radius, statusColors, FONT_NUM, microLabel, controlButton, primaryButton } from '@/lib/theme';
import PinPad from '@/components/ui/PinPad';
import { InlineError } from '@/components/ui/Toast';
import type { HourlyThroughputSnapshot, DelaySnapshot } from '@/types/database';

interface ShowReportModalProps {
  open: boolean;
  attractionId: string;
  attractionName: string;
  dateStr: string;
  userEmail: string;
  displayName: string;
  onClose: () => void;
  onSubmitted: () => void;
}

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatTime24(timeStr: string): string {
  // "14:00" → "2:00 PM"
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${mStr} ${ampm}`;
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${m} ${ampm}`;
}

/* ── Draft helpers ── */

function getDraftKey(attractionId: string, dateStr: string): string {
  return `show-report-draft-${attractionId}-${dateStr}`;
}

interface DraftData {
  operationalReport: string;
  technicalReport: string;
  costumeReport: string;
  constructionReport: string;
  additionalNotes: string;
  savedAt: string;
}

function saveDraftToStorage(attractionId: string, dateStr: string, draft: Omit<DraftData, 'savedAt'>): void {
  try {
    if (typeof window === 'undefined') return;
    const data: DraftData = { ...draft, savedAt: new Date().toISOString() };
    localStorage.setItem(getDraftKey(attractionId, dateStr), JSON.stringify(data));
  } catch { /* localStorage might be unavailable */ }
}

function loadDraftFromStorage(attractionId: string, dateStr: string): DraftData | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(getDraftKey(attractionId, dateStr));
    if (!raw) return null;
    return JSON.parse(raw) as DraftData;
  } catch { return null; }
}

function clearDraftFromStorage(attractionId: string, dateStr: string): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(getDraftKey(attractionId, dateStr));
  } catch { /* ignore */ }
}

export default function ShowReportModal({
  open,
  attractionId,
  attractionName,
  dateStr,
  userEmail, // eslint-disable-line @typescript-eslint/no-unused-vars
  displayName, // eslint-disable-line @typescript-eslint/no-unused-vars
  onClose,
  onSubmitted,
}: ShowReportModalProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-populated data
  const [totalOperatingMinutes, setTotalOperatingMinutes] = useState(0);
  const [totalGuests, setTotalGuests] = useState(0);
  const [hourlyThroughput, setHourlyThroughput] = useState<HourlyThroughputSnapshot[]>([]);
  const [delays, setDelays] = useState<DelaySnapshot[]>([]);

  // Manual entries
  const [operationalReport, setOperationalReport] = useState('');
  const [technicalReport, setTechnicalReport] = useState('');
  const [costumeReport, setCostumeReport] = useState('');
  const [constructionReport, setConstructionReport] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [signature, setSignature] = useState<string | null>(null);

  // Existing report
  const [existingReport, setExistingReport] = useState<{ submittedBy: string; submittedAt: string } | null>(null);
  // Draft info
  const [draftInfo, setDraftInfo] = useState<{ savedAt: string } | null>(null);
  // Draft from Control
  const [draftFromField, setDraftFromField] = useState(false);

  // PIN verification — submitter identity (no lockout by design; wrong PIN = retry)
  const [pinVerified, setPinVerified] = useState(false);
  const [pinUserName, setPinUserName] = useState('');
  const [pinUserEmail, setPinUserEmail] = useState('');
  const [pinPadOpen, setPinPadOpen] = useState(false);
  const [pinAccessError, setPinAccessError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [reportData, existing] = await Promise.all([
        fetchReportData(attractionId, dateStr),
        getExistingReport(attractionId, dateStr),
      ]);

      setTotalOperatingMinutes(reportData.totalOperatingMinutes);
      setTotalGuests(reportData.totalGuests);
      setHourlyThroughput(reportData.hourlyThroughput);
      setDelays(reportData.delays);

      if (existing && !existing.is_draft) {
        // Existing submitted report takes priority
        setOperationalReport(existing.operational_report || '');
        setTechnicalReport(existing.technical_report || '');
        setCostumeReport(existing.costume_report || '');
        setConstructionReport(existing.construction_report || '');
        setAdditionalNotes(existing.additional_notes || '');
        setExistingReport({
          submittedBy: existing.submitted_by_name || existing.submitted_by_email,
          submittedAt: existing.created_at,
        });
        setDraftInfo(null);
        setDraftFromField(false);
      } else if (existing && existing.is_draft) {
        // DB draft from Control notes
        setOperationalReport(existing.operational_report || '');
        setTechnicalReport(existing.technical_report || '');
        setCostumeReport(existing.costume_report || '');
        setConstructionReport(existing.construction_report || '');
        setAdditionalNotes(existing.additional_notes || '');
        setExistingReport(null);
        setDraftInfo(existing.draft_updated_at ? { savedAt: existing.draft_updated_at } : null);
        setDraftFromField(true);
      } else {
        // Check for local draft
        const draft = loadDraftFromStorage(attractionId, dateStr);
        if (draft) {
          setOperationalReport(draft.operationalReport);
          setTechnicalReport(draft.technicalReport);
          setCostumeReport(draft.costumeReport);
          setConstructionReport(draft.constructionReport || '');
          setAdditionalNotes(draft.additionalNotes || '');
          setDraftInfo({ savedAt: draft.savedAt });
        } else {
          setOperationalReport('');
          setTechnicalReport('');
          setCostumeReport('');
          setDraftInfo(null);
        }
        setExistingReport(null);
        setDraftFromField(false);
      }
    } catch {
      setError('Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [attractionId, dateStr]);

  useEffect(() => {
    if (open) {
      setSubmitted(false);
      setDraftSaved(false);
      setSignature(null);
      setDraftFromField(false);
      setPinVerified(false);
      setPinUserName('');
      setPinUserEmail('');
      setPinPadOpen(false);
      setPinAccessError('');
      loadData();
    }
  }, [open, loadData]);

  const handleSaveDraft = () => {
    saveDraftToStorage(attractionId, dateStr, {
      operationalReport,
      technicalReport,
      costumeReport,
      constructionReport,
      additionalNotes,
    });
    setDraftSaved(true);
    setDraftInfo({ savedAt: new Date().toISOString() });
    setTimeout(() => setDraftSaved(false), 2000);
  };

  // PinPad verify callback — returns true on success (closes pad), false to retry.
  async function handlePinVerify(pin: string): Promise<boolean> {
    setPinAccessError('');
    const result = await verifyPin(pin);
    if (!result.valid) return false;

    // Check attraction access — null means all attractions permitted
    if (result.allowedAttractions !== null && !result.allowedAttractions.includes(attractionId)) {
      setPinAccessError(`You don't have access to submit reports for this attraction.`);
      setPinPadOpen(false);
      return true; // close the pad; access error shown inline
    }

    setPinVerified(true);
    setPinUserName(result.userName);
    setPinUserEmail(result.userEmail);
    setPinPadOpen(false);
    return true;
  }

  const handleSubmit = async () => {
    if (!signature || !pinVerified) return;

    setSubmitting(true);
    setError(null);

    const result = await submitShowReport(
      {
        attraction_id: attractionId,
        report_date: dateStr,
        total_operating_minutes: totalOperatingMinutes,
        total_guests: totalGuests,
        hourly_throughput: hourlyThroughput,
        delays,
        operational_report: operationalReport || null,
        technical_report: technicalReport || null,
        costume_report: costumeReport || null,
        construction_report: constructionReport || null,
        additional_notes: additionalNotes || null,
        signature,
        submitted_by_email: pinUserEmail,
        submitted_by_name: pinUserName,
        is_draft: false,
        draft_updated_at: null,
      },
      attractionName,
    );

    setSubmitting(false);

    if (result.success) {
      // Clear the local draft on successful submit
      clearDraftFromStorage(attractionId, dateStr);
      setSubmitted(true);
      setTimeout(() => {
        onSubmitted();
      }, 1500);
    } else {
      setError(result.error || 'Failed to submit report');
    }
  };

  if (!open) return null;

  const delayedColors = statusColors('DELAYED');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        overflowY: 'auto',
        padding: '24px 16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 600,
          background: surface.card,
          border: `1px solid ${border.default}`,
          borderRadius: radius.xl,
          padding: '24px 20px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ color: text.primary, fontSize: 20, fontWeight: 700, margin: 0 }}>
            Show Report — {attractionName}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: text.secondary,
              fontSize: 24,
              cursor: 'pointer',
              padding: '4px 8px',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {existingReport && (
          <div style={{ background: delayedColors.soft, border: `1px solid ${delayedColors.rail}40`, borderRadius: radius.sm, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: delayedColors.text }}>
            Previously submitted by {existingReport.submittedBy} at {formatTimestamp(existingReport.submittedAt)}
          </div>
        )}

        {!existingReport && draftFromField && (
          <div style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: radius.sm, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#4ADE80', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Notes pre-loaded from Control — review before submitting.
          </div>
        )}
        {!existingReport && !draftFromField && draftInfo && (
          <div style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: radius.sm, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#93C5FD', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            Draft saved at {formatTimestamp(draftInfo.savedAt)}
          </div>
        )}

        {loading ? (
          <div style={{ color: text.secondary, textAlign: 'center', padding: 40 }}>Loading report data...</div>
        ) : (
          <>
            {/* ── Section 1: Operating Summary ── */}
            <SectionLabel label="Operating Summary" />
            <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
              <StatCard label="Operating Time" value={formatMinutes(totalOperatingMinutes)} />
              <StatCard label="Total Guests" value={totalGuests.toLocaleString()} />
            </div>

            {/* ── Section 2: Hourly Throughput ── */}
            <SectionLabel label="Hourly Throughput" />
            {hourlyThroughput.length === 0 ? (
              <EmptyState text="No throughput data recorded" />
            ) : (
              <div style={{ marginBottom: 24 }}>
                {hourlyThroughput.map((slot) => (
                  <div
                    key={`${slot.slot_start}-${slot.slot_end}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 14px',
                      background: surface.control,
                      border: `1px solid ${border.divider}`,
                      borderRadius: radius.sm,
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ color: text.secondary, fontSize: 14 }}>
                      {formatTime24(slot.slot_start)} – {formatTime24(slot.slot_end)}
                    </span>
                    <span style={{ color: text.primary, fontSize: 16, fontWeight: 700, ...FONT_NUM }}>
                      {slot.guest_count}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Section 3: Delays ── */}
            <SectionLabel label="Delays" />
            {delays.length === 0 ? (
              <EmptyState text="No delays recorded" />
            ) : (
              <div style={{ marginBottom: 24 }}>
                {delays.map((d, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '10px 14px',
                      background: surface.control,
                      borderRadius: radius.sm,
                      marginBottom: 6,
                      borderLeft: `3px solid ${delayedColors.rail}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: delayedColors.text,
                        background: delayedColors.soft,
                        padding: '2px 8px',
                        borderRadius: 4,
                      }}>
                        {d.reason || 'Unknown'}
                      </span>
                      <span style={{ fontSize: 13, color: text.secondary, ...FONT_NUM }}>
                        {d.duration_minutes != null ? `${d.duration_minutes} min` : 'Ongoing'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: text.muted }}>
                      {formatTimestamp(d.started_at)}
                      {d.resolved_at ? ` → ${formatTimestamp(d.resolved_at)}` : ' → Unresolved'}
                    </div>
                    {d.notes && (
                      <div style={{ fontSize: 12, color: text.secondary, marginTop: 4 }}>{d.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Section 4: Text Reports ── */}
            <SectionLabel label="Reports" />
            <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <TextArea
                label="Operational Report"
                placeholder="Any operational issues or feedback..."
                value={operationalReport}
                onChange={setOperationalReport}
              />
              <TextArea
                label="Technical Report"
                placeholder="Any technical issues or feedback..."
                value={technicalReport}
                onChange={setTechnicalReport}
              />
              <TextArea
                label="Costume Report"
                placeholder="Any costume issues or feedback..."
                value={costumeReport}
                onChange={setCostumeReport}
              />
              <TextArea
                label="Construction Report"
                placeholder="Any construction or set issues or feedback..."
                value={constructionReport}
                onChange={setConstructionReport}
              />
              <TextArea
                label="Additional Notes"
                placeholder="Anything else to note..."
                value={additionalNotes}
                onChange={setAdditionalNotes}
              />
            </div>

            {/* ── Section 5: PIN Verification ── */}
            <SectionLabel label="Verify Identity" />
            {!pinVerified ? (
              <div style={{ marginBottom: 24 }}>
                <p style={{ color: text.muted, fontSize: 13, marginBottom: 12 }}>
                  Enter your PIN to identify yourself as the submitter. This will be logged against your name.
                </p>

                {pinAccessError && (
                  <div style={{ marginBottom: 12 }}>
                    <InlineError message={pinAccessError} />
                  </div>
                )}

                <button
                  onClick={() => { setPinAccessError(''); setPinPadOpen(true); }}
                  style={{
                    ...controlButton,
                    width: '100%',
                    minHeight: 52,
                    padding: '14px 16px',
                    fontSize: 14,
                    fontWeight: 600,
                    color: text.primary,
                    touchAction: 'manipulation',
                  }}
                >
                  Enter PIN
                </button>

                {pinPadOpen && (
                  <PinPad
                    app="control"
                    title="Verify Identity"
                    subtitle="Enter your 4-digit PIN to sign this report"
                    verify={handlePinVerify}
                    onCancel={() => setPinPadOpen(false)}
                  />
                )}
              </div>
            ) : (
              <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: radius.md, padding: '12px 16px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8L6.5 11.5L13 4.5" stroke="#4ADE80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div>
                  <span style={{ color: '#4ADE80', fontSize: 14, fontWeight: 600 }}>{pinUserName}</span>
                  <span style={{ color: text.muted, fontSize: 13 }}> — verified</span>
                </div>
                <button onClick={() => { setPinVerified(false); setSignature(null); }}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: text.muted, fontSize: 12, cursor: 'pointer', padding: '2px 6px' }}>
                  Change
                </button>
              </div>
            )}

            {/* ── Section 6: Signature (only once PIN verified) ── */}
            {pinVerified && (
              <>
                <SectionLabel label="Signature" />
                <div style={{ marginBottom: 24 }}>
                  <SignatureCanvas
                    width={Math.min(560, typeof window !== 'undefined' ? window.innerWidth - 72 : 560)}
                    height={180}
                    onSignatureChange={setSignature}
                  />
                </div>
              </>
            )}

            {/* ── Error ── */}
            {error && (
              <div style={{ marginBottom: 16 }}>
                <InlineError message={error} />
              </div>
            )}

            {/* ── Action Buttons ── */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handleSaveDraft}
                disabled={submitting || submitted}
                style={{
                  ...controlButton,
                  borderRadius: radius.lg,
                  flex: 1, minHeight: 52, padding: '14px 16px',
                  fontSize: 14, fontWeight: 600,
                  cursor: submitting || submitted ? 'not-allowed' : 'pointer',
                  background: draftSaved ? 'rgba(34,197,94,0.12)' : surface.control,
                  borderColor: draftSaved ? 'rgba(34,197,94,0.4)' : border.strong,
                  color: draftSaved ? '#4ADE80' : text.secondary,
                  transition: 'background 0.2s, color 0.2s',
                  touchAction: 'manipulation',
                }}
              >
                {draftSaved ? '✓ Draft Saved' : 'Save Draft'}
              </button>
              <button
                onClick={handleSubmit}
                disabled={!signature || !pinVerified || submitting || submitted}
                style={{
                  ...primaryButton('control'),
                  flex: 2, minHeight: 52, padding: '14px 24px',
                  fontSize: 16, fontWeight: 700,
                  cursor: !signature || !pinVerified || submitting || submitted ? 'not-allowed' : 'pointer',
                  background: submitted ? '#22C55E' : (!signature || !pinVerified) ? surface.raised : undefined,
                  color: submitted || (signature && pinVerified) ? '#fff' : text.faint,
                  transition: 'background 0.2s, color 0.2s',
                  touchAction: 'manipulation',
                }}
              >
                {submitted ? '✓ Report Submitted' : submitting ? 'Submitting...' : existingReport ? 'Update Report' : 'Submit Report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ ...microLabel, color: text.secondary, fontSize: 12, marginBottom: 10 }}>
      {label}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, background: surface.control, border: `1px solid ${border.divider}`, borderRadius: radius.md, padding: '14px 16px', textAlign: 'center' }}>
      <div style={{ ...microLabel, marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#4ADE80', fontSize: 24, fontWeight: 800, ...FONT_NUM }}>{value}</div>
    </div>
  );
}

function EmptyState({ text: emptyText }: { text: string }) {
  return (
    <div style={{ background: surface.control, border: `1px solid ${border.divider}`, borderRadius: radius.sm, padding: '16px 14px', marginBottom: 24, fontSize: 13, color: text.muted, textAlign: 'center' }}>
      {emptyText}
    </div>
  );
}

function TextArea({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label style={{ display: 'block', color: text.secondary, fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
        {label}
        <span style={{ color: text.muted, fontSize: 11, marginLeft: 6 }}>Optional</span>
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        style={{
          width: '100%',
          background: surface.control,
          border: `1px solid ${border.strong}`,
          borderRadius: radius.sm,
          color: text.primary,
          fontSize: 14,
          padding: '10px 12px',
          resize: 'vertical',
          fontFamily: 'inherit',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}
