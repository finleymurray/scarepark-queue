'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkAuth } from '@/lib/auth';
import AdminNav from '@/components/AdminNav';
import { getTodayDateStr } from '@/lib/signoff';
import type { Attraction, ShowReport, HourlyThroughputSnapshot, DelaySnapshot } from '@/types/database';

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
  const attractionMap = new Map(attractions.map((a) => [a.id, a]));
  const reportMap = new Map(reports.map((r) => [r.attraction_id, r]));

  // Only rides for reporting purposes
  const rides = attractions.filter((a) => a.attraction_type === 'ride');
  const submittedCount = rides.filter((a) => reportMap.has(a.id)).length;
  const pendingCount = rides.length - submittedCount;
  const isToday = selectedDate === getTodayDateStr();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#888', fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000' }}>
      <AdminNav userEmail={userEmail} displayName={displayName} onLogout={handleLogout} />

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 80px' }}>
        <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Show Reports</h2>

        {/* ── Filter Bar ── */}
        <div style={{ background: '#111', border: '1px solid #333', borderRadius: 8, padding: '16px 20px', marginBottom: 20, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
          <label style={{ color: '#ccc', fontSize: 13, fontWeight: 500, flexShrink: 0 }}>Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              padding: '8px 12px',
              background: '#1a1a1a',
              border: '1px solid #444',
              borderRadius: 6,
              color: '#e0e0e0',
              fontSize: 14,
              outline: 'none',
            }}
          />
          {!isToday && (
            <button
              onClick={() => setSelectedDate(getTodayDateStr())}
              style={{
                padding: '6px 12px',
                border: '1px solid #555',
                background: 'transparent',
                color: '#ccc',
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Today
            </button>
          )}

          <div style={{ width: 1, height: 24, background: '#333', flexShrink: 0 }} />

          <label style={{ color: '#ccc', fontSize: 13, fontWeight: 500, flexShrink: 0 }}>Attraction</label>
          <select
            value={selectedAttractionId}
            onChange={(e) => setSelectedAttractionId(e.target.value)}
            style={{
              flex: 1,
              minWidth: 140,
              padding: '8px 12px',
              background: '#1a1a1a',
              border: '1px solid #444',
              borderRadius: 6,
              color: '#e0e0e0',
              fontSize: 14,
              outline: 'none',
            }}
          >
            <option value="all">All Attractions</option>
            {rides.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        {/* ── Summary Stats ── */}
        <div style={{ background: '#111', border: '1px solid #333', borderRadius: 8, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 40, flexWrap: 'wrap' }}>
          <div>
            <span style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Submitted</span>
            <div style={{ color: '#4caf50', fontSize: 24, fontWeight: 700 }}>{submittedCount}</div>
          </div>
          <div>
            <span style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Pending</span>
            <div style={{ color: pendingCount > 0 ? '#ffc107' : '#4caf50', fontSize: 24, fontWeight: 700 }}>{pendingCount}</div>
          </div>
          {rides.length > 0 && (
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ width: '100%', height: 8, background: '#222', borderRadius: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${(submittedCount / rides.length) * 100}%`,
                    height: '100%',
                    background: '#4caf50',
                    borderRadius: 4,
                    transition: 'width 0.5s',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Reports ── */}
        {rides.length === 0 && (
          <div style={{ background: '#111', border: '1px solid #333', borderRadius: 8, padding: 40, textAlign: 'center' }}>
            <p style={{ color: '#666', fontSize: 14 }}>No attractions found.</p>
          </div>
        )}

        {rides.map((attraction, idx) => {
          const report = reportMap.get(attraction.id);
          const hasReport = !!report;

          return (
            <fieldset
              key={attraction.id}
              style={{
                border: `1px solid ${hasReport ? '#333' : '#222'}`,
                borderRadius: 16,
                padding: '24px 28px',
                marginBottom: 20,
                background: '#111',
                opacity: hasReport ? 1 : 0.5,
              }}
            >
              <legend style={{ color: '#fff', fontSize: 16, fontWeight: 600, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
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
                {hasReport ? (
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '3px 10px',
                    borderRadius: 12,
                    background: '#0a3d1f',
                    color: '#4caf50',
                  }}>
                    SUBMITTED
                  </span>
                ) : (
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '3px 10px',
                    borderRadius: 12,
                    background: '#3d3000',
                    color: '#ffc107',
                  }}>
                    NOT YET SUBMITTED
                  </span>
                )}
              </legend>

              {!hasReport ? (
                <div style={{ color: '#666', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                  Awaiting report from supervisor
                </div>
              ) : (
                <ReportDetail report={report} />
              )}
            </fieldset>
          );
        })}
      </main>
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
      </div>

      {/* Hourly Throughput */}
      {hourlyThroughput.length > 0 && (
        <div>
          <SubLabel text="Hourly Throughput" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
            {hourlyThroughput.map((slot) => (
              <div key={`${slot.slot_start}-${slot.slot_end}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', background: '#1a1a1a', borderRadius: 6, fontSize: 13 }}>
                <span style={{ color: '#888' }}>{formatTime24(slot.slot_start)} – {formatTime24(slot.slot_end)}</span>
                <span style={{ color: '#fff', fontWeight: 700 }}>{slot.guest_count}</span>
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
            <div key={i} style={{ padding: '8px 12px', background: '#1a1a1a', borderRadius: 6, marginBottom: 6, borderLeft: '3px solid #f0ad4e' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#f0ad4e', background: '#f0ad4e22', padding: '2px 8px', borderRadius: 4 }}>
                  {d.reason || 'Unknown'}
                </span>
                <span style={{ fontSize: 12, color: '#888' }}>{d.duration_minutes != null ? `${d.duration_minutes} min` : 'Ongoing'}</span>
              </div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                {formatTimestamp(d.started_at)} → {d.resolved_at ? formatTimestamp(d.resolved_at) : 'Unresolved'}
              </div>
              {d.notes && <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>{d.notes}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Text Reports */}
      {(report.operational_report || report.technical_report || report.costume_report) && (
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
        </div>
      )}

      {/* Signature */}
      <div>
        <SubLabel text="Signature" />
        <div style={{ background: '#1a1a1a', borderRadius: 8, padding: 12, display: 'inline-block' }}>
          <img
            src={report.signature}
            alt="Supervisor signature"
            style={{ maxWidth: 300, height: 'auto', display: 'block' }}
          />
        </div>
      </div>

      {/* Metadata */}
      <div style={{ fontSize: 12, color: '#666', borderTop: '1px solid #222', paddingTop: 12 }}>
        Submitted by <span style={{ color: '#aaa' }}>{report.submitted_by_name}</span> ({report.submitted_by_email}) &middot; {formatTimestamp(report.created_at)}
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function SubLabel({ text }: { text: string }) {
  return (
    <div style={{ color: '#888', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
      {text}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ flex: 1, minWidth: 100, background: '#1a1a1a', borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
      <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{label}</div>
      <div style={{ color, fontSize: 20, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function ReportBlock({ label, text, borderColor }: { label: string; text: string; borderColor: string }) {
  return (
    <div style={{ padding: '10px 14px', background: '#1a1a1a', borderRadius: 8, borderLeft: `3px solid ${borderColor}` }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: borderColor, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#ddd', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{text}</div>
    </div>
  );
}
