'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkAuth } from '@/lib/auth';
import { SIGNOFF_ROLE_LABELS } from '@/lib/signoff';
import type { Attraction, ShowReport, SignoffCompletion, SignoffSection, SignoffRoleKey } from '@/types/database';

/* ── Helpers ── */

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  return `${h}h ${m}m`;
}

function formatTime(timeStr: string): string {
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${mStr} ${ampm}`;
}

function formatTs(ts: string): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${m} ${ampm}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/* ── Single report page ── */

interface SignoffEntry {
  section: SignoffSection;
  completion: SignoffCompletion;
}

function ReportPage({
  report,
  attraction,
  signoffs,
  isLast,
}: {
  report: ShowReport;
  attraction: Attraction | undefined;
  signoffs: SignoffEntry[];
  isLast: boolean;
}) {
  const throughput = report.hourly_throughput || [];
  const delays = report.delays || [];
  const totalGuests = throughput.reduce((s, t) => s + t.guest_count, 0);

  const attractionName = attraction?.name || 'Unknown Attraction';

  return (
    /*
     * Wrap in a <table> so <thead> repeats on every page break — this gives
     * a running header showing the attraction name on all continuation pages.
     * The <tfoot> repeats similarly at the bottom of each page.
     */
    <table className="report-page" style={{ pageBreakAfter: isLast ? 'avoid' : 'always', breakAfter: isLast ? 'avoid' : 'page' }}>

      {/* Running header — repeats on every continuation page */}
      <thead>
        <tr>
          <td className="running-header-cell">
            <div className="running-header-inner">
              <span className="running-header-name">{attractionName}</span>
              <span className="running-header-meta">End of Night Report · {formatDate(report.report_date)}</span>
            </div>
            <div className="running-rule" />
          </td>
        </tr>
      </thead>

      {/* Running footer — repeats at bottom of every page */}
      <tfoot>
        <tr>
          <td className="running-footer-cell">
            <div className="running-footer-inner">
              <span>Immersive Core — Confidential</span>
              <span>{attractionName} · {formatDate(report.report_date)}</span>
            </div>
          </td>
        </tr>
      </tfoot>

      <tbody>
        <tr>
          <td className="report-body-cell">

            {/* ── First-page header (logo, IC branding, date) ── */}
            <div className="page-header" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
              <div className="page-header-left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-print.png" alt="Immersive Core" className="header-logo" />
                <div>
                  <div className="header-company">Immersive Core</div>
                  <div className="header-doc-type">End of Night Show Report</div>
                </div>
              </div>
              <div className="page-header-right">
                <div className="header-date">{formatDate(report.report_date)}</div>
                <div className="header-submitted">Submitted by {report.submitted_by_name || report.submitted_by_email}</div>
              </div>
            </div>

            <div className="header-rule" />
            <h1 className="attraction-title">{attractionName}</h1>

            {/* ── Summary stats — keep together ── */}
            <div className="stats-row">
              <div className="stat-box">
                <div className="stat-label">Operating Time</div>
                <div className="stat-value">{formatMinutes(report.total_operating_minutes)}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Total Guests</div>
                <div className="stat-value">{(totalGuests || report.total_guests || 0).toLocaleString()}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Delay Incidents</div>
                <div className="stat-value" style={{ color: delays.length > 0 ? '#c0392b' : undefined }}>{delays.length}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Total Downtime</div>
                <div className="stat-value" style={{ color: delays.length > 0 ? '#c0392b' : undefined }}>
                  {delays.length > 0 ? formatMinutes(delays.reduce((s, d) => s + (d.duration_minutes || 0), 0)) : '—'}
                </div>
              </div>
            </div>

            {/* ── Hourly Throughput ── */}
            <div className="section">
              <h2 className="section-title">Hourly Throughput</h2>
              {throughput.length === 0 ? (
                <p className="empty-text">No throughput data recorded.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr><th>Time Slot</th><th className="text-right">Guests</th></tr>
                  </thead>
                  <tbody>
                    {throughput.map((slot) => (
                      <tr key={`${slot.slot_start}-${slot.slot_end}`}>
                        <td>{formatTime(slot.slot_start)} – {formatTime(slot.slot_end)}</td>
                        <td className="text-right font-bold">{slot.guest_count}</td>
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td className="font-bold">Total</td>
                      <td className="text-right font-bold">{totalGuests.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Delay Log ── */}
            <div className="section">
              <h2 className="section-title">Delay Log</h2>
              {delays.length === 0 ? (
                <p className="empty-text">No delays recorded.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Time</th><th>Reason</th><th>Notes</th><th className="text-right">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {delays.map((d, i) => (
                      <tr key={i}>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {formatTs(d.started_at)}{d.resolved_at ? ` – ${formatTs(d.resolved_at)}` : ' (unresolved)'}
                        </td>
                        <td>{d.reason || '—'}</td>
                        <td style={{ color: '#555', fontStyle: d.notes ? 'normal' : 'italic' }}>{d.notes || '—'}</td>
                        <td className="text-right">{d.duration_minutes != null ? `${d.duration_minutes} min` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Text Reports ── */}
            {(report.operational_report || report.technical_report || report.costume_report || report.construction_report || report.additional_notes) && (
              <div className="section">
                <h2 className="section-title">Reports</h2>
                <div className="reports-grid">
                  {report.operational_report && (
                    <div className="report-text-box">
                      <div className="report-text-label">Operational</div>
                      <div className="report-text-body">{report.operational_report}</div>
                    </div>
                  )}
                  {report.technical_report && (
                    <div className="report-text-box">
                      <div className="report-text-label">Technical</div>
                      <div className="report-text-body">{report.technical_report}</div>
                    </div>
                  )}
                  {report.costume_report && (
                    <div className="report-text-box">
                      <div className="report-text-label">Costume</div>
                      <div className="report-text-body">{report.costume_report}</div>
                    </div>
                  )}
                  {report.construction_report && (
                    <div className="report-text-box">
                      <div className="report-text-label">Construction</div>
                      <div className="report-text-body">{report.construction_report}</div>
                    </div>
                  )}
                  {report.additional_notes && (
                    <div className="report-text-box">
                      <div className="report-text-label">Additional Notes</div>
                      <div className="report-text-body">{report.additional_notes}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Sign-Off Record ── */}
            {signoffs.length > 0 && (
              <div className="section">
                <h2 className="section-title">Sign-Off Record</h2>
                {(['opening', 'closing'] as const).map((phase) => {
                  const phaseEntries = signoffs.filter((s) => s.section.phase === phase);
                  if (phaseEntries.length === 0) return null;
                  return (
                    <div key={phase} style={{ marginBottom: 10, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                      <div style={{ fontSize: '8.5pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', marginBottom: 4 }}>
                        {phase === 'opening' ? 'Opening' : 'Closing'}
                      </div>
                      <table className="data-table">
                        <thead>
                          <tr><th>Section</th><th>Role</th><th>Signed by</th><th className="text-right">Time</th></tr>
                        </thead>
                        <tbody>
                          {phaseEntries
                            .sort((a, b) => a.section.sort_order - b.section.sort_order)
                            .map(({ section, completion }) => (
                              <tr key={completion.id}>
                                <td>{section.name}</td>
                                <td style={{ color: '#666' }}>{SIGNOFF_ROLE_LABELS[section.role_key as SignoffRoleKey] || section.role_key}</td>
                                <td style={{ fontWeight: 600 }}>{completion.signed_by_name || completion.signed_by_email}</td>
                                <td className="text-right" style={{ whiteSpace: 'nowrap' }}>{formatTs(completion.signed_at)}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Signature — always keep together, push toward end ── */}
            <div className="section signature-section">
              <h2 className="section-title">Signature</h2>
              <div className="signature-row">
                {report.signature ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={report.signature} alt="Signature" className="signature-img" />
                ) : (
                  <div className="signature-blank" />
                )}
                <div className="signature-meta">
                  <div className="signature-name">{report.submitted_by_name || report.submitted_by_email}</div>
                  <div className="signature-label">Submitted by</div>
                </div>
              </div>
            </div>

          </td>
        </tr>
      </tbody>
    </table>
  );
}

/* ── Main print view ── */

function PrintContent() {
  const searchParams = useSearchParams();
  const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];

  const [reports, setReports] = useState<ShowReport[]>([]);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [completions, setCompletions] = useState<SignoffCompletion[]>([]);
  const [sections, setSections] = useState<SignoffSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoPrint, setAutoPrint] = useState(false);

  useEffect(() => {
    async function init() {
      const auth = await checkAuth();
      if (!auth.authenticated || auth.role !== 'admin') {
        setError('Access denied.');
        setLoading(false);
        return;
      }

      const [reportsRes, attractionsRes, completionsRes, sectionsRes] = await Promise.all([
        supabase.from('show_reports').select('*').eq('report_date', dateStr).order('created_at', { ascending: true }),
        supabase.from('attractions').select('*').order('sort_order', { ascending: true }),
        supabase.from('signoff_completions').select('*').eq('sign_date', dateStr),
        supabase.from('signoff_sections').select('*').order('sort_order', { ascending: true }),
      ]);

      setReports(reportsRes.data || []);
      setAttractions(attractionsRes.data || []);
      setCompletions(completionsRes.data || []);
      setSections(sectionsRes.data || []);
      setLoading(false);

      // Auto-print if ?print=1
      if (searchParams.get('print') === '1') {
        setAutoPrint(true);
      }
    }
    init();
  }, [dateStr, searchParams]);

  useEffect(() => {
    if (!loading && !error && autoPrint && reports.length > 0) {
      setTimeout(() => window.print(), 600);
    }
  }, [loading, error, autoPrint, reports.length]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', color: '#666' }}>
        Loading reports…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', color: '#c0392b' }}>
        {error}
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', color: '#666' }}>
        No reports found for {formatDate(dateStr)}.
      </div>
    );
  }

  return (
    <>
      {/* Screen-only print toolbar */}
      <div className="print-toolbar no-print">
        <div className="toolbar-info">
          <strong>{reports.length} report{reports.length !== 1 ? 's' : ''}</strong>
          {' '}for {formatDate(dateStr)}
        </div>
        <button className="print-btn" onClick={() => window.print()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Print / Save as PDF
        </button>
      </div>

      {/* Report pages */}
      <div className="print-container">
        {reports.map((report, idx) => {
          // Build signoff entries for this attraction
          const attractionCompletions = completions.filter((c) => c.attraction_id === report.attraction_id);
          const signoffs: SignoffEntry[] = attractionCompletions
            .map((c) => {
              const section = sections.find((s) => s.id === c.section_id);
              return section ? { section, completion: c } : null;
            })
            .filter((e): e is SignoffEntry => e !== null);

          return (
            <ReportPage
              key={report.id}
              report={report}
              attraction={attractions.find((a) => a.id === report.attraction_id)}
              signoffs={signoffs}
              isLast={idx === reports.length - 1}
            />
          );
        })}
      </div>

      <style>{`
        * { box-sizing: border-box; }

        body {
          margin: 0;
          background: #f5f5f5;
          font-family: 'Helvetica Neue', Arial, sans-serif;
          font-size: 11pt;
          color: #111;
          orphans: 3;
          widows: 3;
        }

        /* ── Screen toolbar ── */
        .print-toolbar {
          position: sticky; top: 0; z-index: 100;
          background: #1E1E1E; color: #fff;
          padding: 12px 24px;
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          font-family: 'Helvetica Neue', Arial, sans-serif;
        }
        .toolbar-info { font-size: 14px; color: #aaa; }
        .toolbar-info strong { color: #fff; }
        .print-btn {
          display: flex; align-items: center; gap: 8px;
          background: #fff; color: #111; border: none; border-radius: 6px;
          padding: 8px 18px; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: background 0.15s;
        }
        .print-btn:hover { background: #e8e8e8; }

        /* ── Print container ── */
        .print-container { padding: 24px; display: flex; flex-direction: column; gap: 24px; }

        /* ── Report page wrapper (now a <table>) ── */
        .report-page {
          background: #fff;
          width: 210mm;
          margin: 0 auto;
          box-shadow: 0 2px 12px rgba(0,0,0,0.12);
          border-collapse: collapse;
          table-layout: fixed;
        }

        /* ── Running header cell (repeats on every page via <thead>) ── */
        .running-header-cell { padding: 10mm 20mm 0; }
        .running-header-inner {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          padding-bottom: 5px;
        }
        .running-header-name {
          font-size: 10pt; font-weight: 700; color: #111;
        }
        .running-header-meta {
          font-size: 8pt; color: #888;
        }
        .running-rule {
          border-top: 1px solid #ccc;
          margin-top: 4px;
        }

        /* ── Running footer cell (repeats on every page via <tfoot>) ── */
        .running-footer-cell { padding: 0 20mm 8mm; }
        .running-footer-inner {
          display: flex;
          justify-content: space-between;
          font-size: 8pt;
          color: #bbb;
          border-top: 1px solid #eee;
          padding-top: 6px;
          margin-top: 6px;
        }

        /* ── Main body cell ── */
        .report-body-cell { padding: 8mm 20mm 6mm; }

        /* ── First-page document header ── */
        .page-header {
          display: flex; align-items: flex-start;
          justify-content: space-between; margin-bottom: 8px;
          page-break-inside: avoid; break-inside: avoid;
        }
        .page-header-left { display: flex; align-items: center; gap: 12px; }
        .header-logo { width: 36px; height: 36px; object-fit: contain; }
        .header-company { font-size: 14pt; font-weight: 700; color: #111; line-height: 1.1; }
        .header-doc-type { font-size: 9pt; color: #888; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
        .page-header-right { text-align: right; }
        .header-date { font-size: 10pt; font-weight: 600; color: #333; }
        .header-submitted { font-size: 9pt; color: #888; margin-top: 2px; }
        .header-rule { border: none; border-top: 2px solid #111; margin: 8px 0 14px; }

        /* ── Attraction title ── */
        .attraction-title {
          font-size: 22pt; font-weight: 800; color: #111;
          margin: 0 0 16px; letter-spacing: -0.02em;
          page-break-after: avoid; break-after: avoid;
        }

        /* ── Stats row — always keep together ── */
        .stats-row {
          display: flex; gap: 12px; margin-bottom: 20px;
          page-break-inside: avoid; break-inside: avoid;
        }
        .stat-box {
          flex: 1; border: 1px solid #ddd; border-radius: 6px;
          padding: 10px 12px; text-align: center;
        }
        .stat-label { font-size: 8pt; color: #888; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
        .stat-value { font-size: 16pt; font-weight: 800; color: #111; }

        /* ── Sections ── */
        .section { margin-bottom: 16px; }

        /* Keep section title glued to first row of content */
        .section-title {
          font-size: 10pt; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.06em; color: #444;
          margin: 0 0 8px; padding-bottom: 4px;
          border-bottom: 1px solid #e8e8e8;
          page-break-after: avoid; break-after: avoid;
        }
        .empty-text { font-size: 10pt; color: #aaa; margin: 0; font-style: italic; }

        /* ── Data tables ── */
        .data-table { width: 100%; border-collapse: collapse; font-size: 10pt; }
        .data-table th {
          text-align: left; font-size: 8.5pt; font-weight: 600; color: #888;
          text-transform: uppercase; letter-spacing: 0.04em;
          padding: 5px 8px; border-bottom: 1px solid #ddd;
          /* thead repeats automatically across page breaks */
        }
        .data-table td {
          padding: 6px 8px; border-bottom: 1px solid #f0f0f0; color: #222;
          page-break-inside: avoid; break-inside: avoid;
        }
        .data-table tr { page-break-inside: avoid; break-inside: avoid; }
        .data-table .total-row td {
          border-top: 1.5px solid #bbb; border-bottom: none; background: #fafafa;
        }
        .text-right { text-align: right !important; }
        .font-bold { font-weight: 700; }

        /* ── Text report boxes — keep each box together ── */
        .reports-grid { display: flex; flex-direction: column; gap: 10px; }
        .report-text-box {
          border: 1px solid #e0e0e0; border-radius: 6px; padding: 10px 12px;
          page-break-inside: avoid; break-inside: avoid;
        }
        .report-text-label {
          font-size: 8.5pt; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.05em; color: #888; margin-bottom: 4px;
        }
        .report-text-body { font-size: 10pt; color: #222; white-space: pre-wrap; line-height: 1.5; }

        /* ── Signature — always keep together ── */
        .signature-section {
          margin-top: 16px;
          page-break-inside: avoid; break-inside: avoid;
        }
        .signature-row { display: flex; align-items: flex-end; gap: 20px; }
        .signature-img {
          height: 60px; max-width: 220px; object-fit: contain;
          border-bottom: 1.5px solid #333; padding-bottom: 4px;
        }
        .signature-blank { width: 220px; height: 60px; border-bottom: 1.5px solid #333; }
        .signature-meta { padding-bottom: 4px; }
        .signature-name { font-size: 10pt; font-weight: 600; color: #222; }
        .signature-label { font-size: 8pt; color: #999; margin-top: 2px; }

        /* ── Print media ── */
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
            /* Page numbers bottom-right of every page */
            @bottom-right {
              content: "Page " counter(page);
              font-family: 'Helvetica Neue', Arial, sans-serif;
              font-size: 8pt;
              color: #999;
              margin-bottom: 6mm;
              margin-right: 20mm;
            }
          }

          body { background: white; }
          .no-print { display: none !important; }
          .print-container { padding: 0; gap: 0; }

          .report-page {
            box-shadow: none;
            margin: 0;
            width: 100%;
          }

          /* Don't add extra spacing in print */
          .running-header-cell { padding-top: 8mm; }
          .report-body-cell { padding-top: 6mm; }
        }
      `}</style>
    </>
  );
}

export default function PrintPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', color: '#666' }}>Loading…</div>}>
      <PrintContent />
    </Suspense>
  );
}
