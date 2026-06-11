'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkAuth } from '@/lib/auth';
import AdminNav from '@/components/AdminNav';
import { getTodayDateStr } from '@/lib/signoff';
import type { Attraction, ShowReport, HourlyThroughputSnapshot, DelaySnapshot } from '@/types/database';
import { surface, border, text as tc, radius, microLabel, FONT_NUM } from '@/lib/theme';
import MetricStat from '@/components/ui/MetricStat';

/* ── Helpers ── */

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatTime24(timeStr: string): string {
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${mStr} ${ampm}`;
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear().toString().slice(2);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${day}/${month}/${year} ${h12}:${m} ${ampm}`;
}

/* ── Main Page ── */

export default function ShowReportsPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [reports, setReports] = useState<ShowReport[]>([]);

  const [selectedDate, setSelectedDate] = useState(getTodayDateStr());
  const [selectedAttractionId, setSelectedAttractionId] = useState<string>('all');

  /* ── Init ── */
  useEffect(() => {
    async function init() {
      const auth = await checkAuth();
      if (!auth.authenticated || auth.role !== 'admin') {
        router.push('/admin/login');
        return;
      }
      setUserEmail(auth.email || '');
      setDisplayName(auth.displayName || '');

      const { data: attrData } = await supabase
        .from('attractions')
        .select('*')
        .order('sort_order', { ascending: true });
      setAttractions(attrData || []);
      setLoading(false);
    }
    init();
  }, [router]);

  /* ── Fetch reports ── */
  const fetchReports = useCallback(async (date: string, attractionId: string) => {
    let query = supabase
      .from('show_reports')
      .select('*')
      .eq('report_date', date);

    if (attractionId !== 'all') {
      query = query.eq('attraction_id', attractionId);
    }

    const { data } = await query;
    setReports((data as ShowReport[]) || []);
  }, []);

  useEffect(() => {
    if (!loading) fetchReports(selectedDate, selectedAttractionId);
  }, [selectedDate, selectedAttractionId, loading, fetchReports]);

  /* ── Realtime ── */
  useEffect(() => {
    const channel = supabase
      .channel('admin-show-reports')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'show_reports' }, () => {
        fetchReports(selectedDate, selectedAttractionId);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedDate, selectedAttractionId, fetchReports]);

  /* ── Derived data ── */
  // Build maps for submitted and draft reports separately
  const submittedReportMap = new Map(reports.filter((r) => !r.is_draft).map((r) => [r.attraction_id, r]));
  const draftReportMap = new Map(reports.filter((r) => r.is_draft).map((r) => [r.attraction_id, r]));
  // reportMap = any report (for backward compat)
  const reportMap = new Map(reports.map((r) => [r.attraction_id, r]));

  // Filter attractions based on dropdown selection
  const displayedAttractions = selectedAttractionId === 'all'
    ? attractions
    : attractions.filter((a) => a.id === selectedAttractionId);
  const submittedCount = displayedAttractions.filter((a) => submittedReportMap.has(a.id)).length;
  const draftCount = displayedAttractions.filter((a) => draftReportMap.has(a.id) && !submittedReportMap.has(a.id)).length;
  const pendingCount = displayedAttractions.length - submittedCount - draftCount;
  const isToday = selectedDate === getTodayDateStr();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: surface.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: tc.secondary, fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: surface.page }}>
      <AdminNav userEmail={userEmail} displayName={displayName} onLogout={handleLogout} />

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ color: tc.primary, fontSize: 22, fontWeight: 700, margin: 0 }}>Show Reports</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {submittedCount > 0 && (
              <a
                href={`/admin/reports/print?date=${selectedDate}&print=1`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '6px 14px',
                  background: '#2563EB',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  textDecoration: 'none',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                Export PDF ({submittedCount})
              </a>
            )}
            <button
              onClick={() => fetchReports(selectedDate, selectedAttractionId)}
              style={{
                padding: '8px 14px',
                background: surface.control,
                border: `1px solid ${border.strong}`,
                borderRadius: radius.md,
                color: tc.secondary,
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M14 8A6 6 0 1 1 8 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M8 0L10.5 2.5L8 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* ── Filter Bar ── */}
        <div style={{ background: surface.card, border: `1px solid ${border.default}`, borderRadius: radius.xl, padding: '16px 20px', marginBottom: 20, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
          <label style={{ color: tc.secondary, fontSize: 13, fontWeight: 500, flexShrink: 0 }}>Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              padding: '9px 12px',
              background: surface.control,
              border: `1px solid ${border.strong}`,
              borderRadius: radius.md,
              color: tc.primary,
              fontSize: 14,
              outline: 'none',
            }}
          />
          {!isToday && (
            <button
              onClick={() => setSelectedDate(getTodayDateStr())}
              style={{
                padding: '6px 12px',
                border: `1px solid ${border.strong}`,
                background: 'transparent',
                color: tc.secondary,
                fontSize: 12,
                fontWeight: 500,
                borderRadius: radius.md,
                cursor: 'pointer',
              }}
            >
              Today
            </button>
          )}

          <div style={{ width: 1, height: 24, background: border.default, flexShrink: 0 }} />

          <label style={{ color: tc.secondary, fontSize: 13, fontWeight: 500, flexShrink: 0 }}>Attraction</label>
          <select
            value={selectedAttractionId}
            onChange={(e) => setSelectedAttractionId(e.target.value)}
            style={{
              flex: 1,
              minWidth: 140,
              padding: '9px 12px',
              background: surface.control,
              border: `1px solid ${border.strong}`,
              borderRadius: radius.md,
              color: tc.primary,
              fontSize: 14,
              outline: 'none',
            }}
          >
            <option value="all">All Attractions</option>
            {attractions.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        {/* ── Summary Stats ── */}
        <div style={{ background: surface.card, border: `1px solid ${border.default}`, borderRadius: radius.xl, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 40, flexWrap: 'wrap' }}>
          <MetricStat label="Submitted" value={submittedCount} size={24} color="#4ADE80" />
          <MetricStat label="Drafts" value={draftCount} size={24} color={draftCount > 0 ? '#FBBF24' : tc.muted} />
          <MetricStat label="Pending" value={pendingCount} size={24} color={pendingCount > 0 ? '#FBBF24' : '#4ADE80'} />
          {displayedAttractions.length > 0 && (
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ position: 'relative', width: '100%', height: 8, background: surface.raised, borderRadius: 4, overflow: 'hidden' }}>
                {/* Blur/glow layer */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, height: '100%',
                  width: `${(submittedCount / displayedAttractions.length) * 100}%`,
                  background: 'linear-gradient(90deg, #8B5CF6, #22C55E)',
                  borderRadius: 4, filter: 'blur(6px)', opacity: 0.6,
                  transition: 'width 0.5s',
                }} />
                {/* Fill layer */}
                <div style={{
                  position: 'relative', height: '100%',
                  width: `${(submittedCount / displayedAttractions.length) * 100}%`,
                  background: 'linear-gradient(90deg, #8B5CF6, #22C55E)',
                  borderRadius: 4, transition: 'width 0.5s',
                }} />
              </div>
            </div>
          )}
        </div>

        {/* ── Reports ── */}
        {displayedAttractions.length === 0 && (
          <div style={{ background: surface.card, border: `1px solid ${border.default}`, borderRadius: radius.xl, padding: 40, textAlign: 'center' }}>
            <p style={{ color: tc.muted, fontSize: 14 }}>No attractions found.</p>
          </div>
        )}

        {displayedAttractions.map((attraction, idx) => {
          const submittedReport = submittedReportMap.get(attraction.id);
          const draftReport = draftReportMap.get(attraction.id);
          const report = submittedReport || draftReport;
          const hasSubmitted = !!submittedReport;
          const hasDraft = !hasSubmitted && !!draftReport;

          return (
            <fieldset
              key={attraction.id}
              style={{
                border: `1px solid ${hasSubmitted ? '#22C55E33' : hasDraft ? '#F59E0B33' : border.default}`,
                borderRadius: radius.xl,
                padding: '24px 28px',
                marginBottom: 20,
                background: surface.card,
                opacity: report ? 1 : 0.65,
              }}
            >
              <legend style={{ color: tc.primary, fontSize: 16, fontWeight: 600, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  background: '#fff',
                  color: '#000',
                  borderRadius: '50%',
                  fontSize: 14,
                  fontWeight: 700,
                }}>
                  {idx + 1}
                </span>
                {attraction.name}
                {hasSubmitted ? (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, background: '#0a3d1f', color: '#22C55E' }}>
                    SUBMITTED
                  </span>
                ) : hasDraft ? (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, background: '#3d2500', color: '#F59E0B' }}>
                    DRAFT
                  </span>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, background: '#3d3000', color: '#ffc107' }}>
                    NOT YET SUBMITTED
                  </span>
                )}
              </legend>

              {!report ? (
                <div style={{ color: tc.muted, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                  Awaiting report from supervisor
                </div>
              ) : hasDraft ? (
                <DraftDetail report={draftReport!} />
              ) : (
                <ReportDetail report={submittedReport!} />
              )}
            </fieldset>
          );
        })}
      </main>
    </div>
  );
}

/* ── Draft Detail Component ── */

function DraftDetail({ report }: { report: ShowReport }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
      <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid #F59E0B33', borderRadius: radius.sm, padding: '10px 14px', fontSize: 13, color: '#FBBF24' }}>
        Draft in progress — not yet submitted.
        {report.draft_updated_at && ` Last updated: ${formatTimestamp(report.draft_updated_at)}`}
      </div>
      {(report.operational_report || report.technical_report || report.costume_report || report.construction_report || report.additional_notes) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {report.operational_report && <ReportBlock label="Operational Report" text={report.operational_report} borderColor="#6ea8fe" />}
          {report.technical_report && <ReportBlock label="Technical Report" text={report.technical_report} borderColor="#f0ad4e" />}
          {report.costume_report && <ReportBlock label="Costume Report" text={report.costume_report} borderColor="#c084fc" />}
          {report.construction_report && <ReportBlock label="Construction Report" text={report.construction_report} borderColor="#34d399" />}
          {report.additional_notes && <ReportBlock label="Additional Notes" text={report.additional_notes} borderColor="#94A3B8" />}
        </div>
      ) : (
        <div style={{ color: tc.muted, fontSize: 13, textAlign: 'center', padding: '8px 0' }}>No notes written yet.</div>
      )}
    </div>
  );
}

/* ── Report Detail Component ── */

function ReportDetail({ report }: { report: ShowReport }) {
  const hourlyThroughput = (report.hourly_throughput || []) as HourlyThroughputSnapshot[];
  const delays = (report.delays || []) as DelaySnapshot[];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 8 }}>
      {/* Operating Summary */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <MiniStat label="Operating Time" value={formatMinutes(report.total_operating_minutes)} color="#22C55E" />
        <MiniStat label="Total Guests" value={report.total_guests.toLocaleString()} color="#22C55E" />
        <MiniStat label="Delays" value={delays.length.toString()} color={delays.length > 0 ? '#f0ad4e' : '#22C55E'} />
        {(() => {
          const totalDowntime = delays.reduce((s, d) => s + (d.duration_minutes || 0), 0);
          return totalDowntime > 0 ? (
            <MiniStat label="Total Downtime" value={formatMinutes(totalDowntime)} color="#f0ad4e" />
          ) : null;
        })()}
      </div>

      {/* Hourly Throughput */}
      {hourlyThroughput.length > 0 && (
        <div>
          <SubLabel text="Hourly Throughput" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
            {hourlyThroughput.map((slot) => (
              <div key={`${slot.slot_start}-${slot.slot_end}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', background: surface.control, borderRadius: radius.sm, fontSize: 13 }}>
                <span style={{ color: tc.secondary }}>{formatTime24(slot.slot_start)} – {formatTime24(slot.slot_end)}</span>
                <span style={{ color: tc.primary, fontWeight: 700, ...FONT_NUM }}>{slot.guest_count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delays */}
      {delays.length > 0 && (
        <div>
          <SubLabel text="Delays" />
          {delays.map((d, i) => (
            <div key={i} style={{ padding: '8px 12px', background: surface.control, borderRadius: radius.sm, marginBottom: 6, borderLeft: '3px solid #F59E0B' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#F59E0B', background: '#F59E0B22', padding: '2px 8px', borderRadius: 4 }}>
                  {d.reason || 'Unknown'}
                </span>
                <span style={{ fontSize: 12, color: tc.muted, ...FONT_NUM }}>{d.duration_minutes != null ? `${d.duration_minutes} min` : 'Ongoing'}</span>
              </div>
              <div style={{ fontSize: 12, color: tc.muted, marginTop: 4 }}>
                {formatTimestamp(d.started_at)} → {d.resolved_at ? formatTimestamp(d.resolved_at) : 'Unresolved'}
              </div>
              {d.notes && <div style={{ fontSize: 12, color: tc.secondary, marginTop: 2 }}>{d.notes}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Text Reports */}
      {(report.operational_report || report.technical_report || report.costume_report || report.construction_report || report.additional_notes) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {report.operational_report && (
            <ReportBlock label="Operational Report" text={report.operational_report} borderColor="#6ea8fe" />
          )}
          {report.technical_report && (
            <ReportBlock label="Technical Report" text={report.technical_report} borderColor="#f0ad4e" />
          )}
          {report.costume_report && (
            <ReportBlock label="Costume Report" text={report.costume_report} borderColor="#c084fc" />
          )}
          {report.construction_report && (
            <ReportBlock label="Construction Report" text={report.construction_report} borderColor="#34d399" />
          )}
          {report.additional_notes && (
            <ReportBlock label="Additional Notes" text={report.additional_notes} borderColor="#94A3B8" />
          )}
        </div>
      )}

      {/* Signature */}
      {report.signature && (
        <div>
          <SubLabel text="Signature" />
          <div style={{ background: surface.control, borderRadius: radius.sm, padding: 12, display: 'inline-block' }}>
            <img
              src={report.signature}
              alt="Supervisor signature"
              style={{ maxWidth: 300, height: 'auto', display: 'block' }}
            />
          </div>
        </div>
      )}

      {/* Metadata */}
      <div style={{ fontSize: 12, color: tc.muted, borderTop: `1px solid ${border.divider}`, paddingTop: 12 }}>
        Submitted by <span style={{ color: tc.secondary }}>{report.submitted_by_name}</span> ({report.submitted_by_email}) &middot; {formatTimestamp(report.created_at)}
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function SubLabel({ text }: { text: string }) {
  return (
    <div style={{ ...microLabel, marginBottom: 8 }}>
      {text}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ flex: 1, minWidth: 100, background: surface.control, borderRadius: radius.sm, padding: '12px 14px' }}>
      <MetricStat label={label} value={value} color={color} align="center" />
    </div>
  );
}

function ReportBlock({ label, text, borderColor }: { label: string; text: string; borderColor: string }) {
  return (
    <div style={{ padding: '10px 14px', background: surface.control, borderRadius: radius.sm, borderLeft: `3px solid ${borderColor}` }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: borderColor, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: tc.secondary, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{text}</div>
    </div>
  );
}
