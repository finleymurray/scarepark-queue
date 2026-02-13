'use client';

import { useEffect, useState, useCallback } from 'react';
import SignatureCanvas from './SignatureCanvas';
import { fetchReportData, getExistingReport, submitShowReport } from '@/lib/showReport';
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

export default function ShowReportModal({
  open,
  attractionId,
  attractionName,
  dateStr,
  userEmail,
  displayName,
  onClose,
  onSubmitted,
}: ShowReportModalProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
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
  const [signature, setSignature] = useState<string | null>(null);

  // Existing report
  const [existingReport, setExistingReport] = useState<{ submittedBy: string; submittedAt: string } | null>(null);

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

      if (existing) {
        setOperationalReport(existing.operational_report || '');
        setTechnicalReport(existing.technical_report || '');
        setCostumeReport(existing.costume_report || '');
        setExistingReport({
          submittedBy: existing.submitted_by_name || existing.submitted_by_email,
          submittedAt: existing.created_at,
        });
      } else {
        setOperationalReport('');
        setTechnicalReport('');
        setCostumeReport('');
        setExistingReport(null);
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
      setSignature(null);
      loadData();
    }
  }, [open, loadData]);

  const handleSubmit = async () => {
    if (!signature) return;

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
        signature,
        submitted_by_email: userEmail,
        submitted_by_name: displayName,
      },
      attractionName,
    );

    setSubmitting(false);

    if (result.success) {
      setSubmitted(true);
      setTimeout(() => {
        onSubmitted();
      }, 1500);
    } else {
      setError(result.error || 'Failed to submit report');
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(0,0,0,0.9)',
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
          background: '#111',
          border: '1px solid #333',
          borderRadius: 16,
          padding: '24px 20px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>
            Show Report — {attractionName}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#aaa',
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
          <div style={{ background: '#1a1a1a', border: '1px solid #f0ad4e33', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#f0ad4e' }}>
            Previously submitted by {existingReport.submittedBy} at {formatTimestamp(existingReport.submittedAt)}
          </div>
        )}

        {loading ? (
          <div style={{ color: '#aaa', textAlign: 'center', padding: 40 }}>Loading report data...</div>
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
                      background: '#1a1a1a',
                      borderRadius: 8,
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ color: '#aaa', fontSize: 14 }}>
                      {formatTime24(slot.slot_start)} – {formatTime24(slot.slot_end)}
                    </span>
                    <span style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>
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
                      background: '#1a1a1a',
                      borderRadius: 8,
                      marginBottom: 6,
                      borderLeft: '3px solid #f0ad4e',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#f0ad4e',
                        background: '#f0ad4e22',
                        padding: '2px 8px',
                        borderRadius: 4,
                      }}>
                        {d.reason || 'Unknown'}
                      </span>
                      <span style={{ fontSize: 13, color: '#aaa' }}>
                        {d.duration_minutes != null ? `${d.duration_minutes} min` : 'Ongoing'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#888' }}>
                      {formatTimestamp(d.started_at)}
                      {d.resolved_at ? ` → ${formatTimestamp(d.resolved_at)}` : ' → Unresolved'}
                    </div>
                    {d.notes && (
                      <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>{d.notes}</div>
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
            </div>

            {/* ── Section 5: Signature ── */}
            <SectionLabel label="Supervisor Signature" />
            <div style={{ marginBottom: 24 }}>
              <SignatureCanvas
                width={Math.min(560, typeof window !== 'undefined' ? window.innerWidth - 72 : 560)}
                height={180}
                onSignatureChange={setSignature}
              />
            </div>

            {/* ── Error ── */}
            {error && (
              <div style={{ background: '#dc354520', border: '1px solid #dc354555', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#dc3545' }}>
                {error}
              </div>
            )}

            {/* ── Submit ── */}
            <button
              onClick={handleSubmit}
              disabled={!signature || submitting || submitted}
              style={{
                width: '100%',
                padding: '14px 24px',
                borderRadius: 12,
                border: 'none',
                fontSize: 16,
                fontWeight: 700,
                cursor: !signature || submitting || submitted ? 'not-allowed' : 'pointer',
                background: submitted
                  ? '#22C55E'
                  : !signature
                    ? '#333'
                    : '#dc3545',
                color: submitted || signature ? '#fff' : '#666',
                transition: 'background 0.2s, color 0.2s',
              }}
            >
              {submitted
                ? '✓ Report Submitted'
                : submitting
                  ? 'Submitting...'
                  : existingReport
                    ? 'Update Report'
                    : 'Submit Report'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {label}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, background: '#1a1a1a', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
      <div style={{ color: '#aaa', fontSize: 12, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ color: '#22C55E', fontSize: 24, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ background: '#1a1a1a', borderRadius: 8, padding: '16px 14px', marginBottom: 24, fontSize: 13, color: '#666', textAlign: 'center' }}>
      {text}
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
      <label style={{ display: 'block', color: '#aaa', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
        {label}
        <span style={{ color: '#666', fontSize: 11, marginLeft: 6 }}>Optional</span>
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        style={{
          width: '100%',
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: 8,
          color: '#fff',
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
