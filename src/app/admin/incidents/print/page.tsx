'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkAuth } from '@/lib/auth';
import type { Incident, IncidentSource } from '@/types/database';

/* ── Helpers ── */

function formatTs(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function sourceLabel(inc: Incident): string {
  const map: Record<IncidentSource, string> = {
    operator: 'Operator report',
    delay_auto: `Auto-logged (${inc.delay_reason || 'unspecified'} delay)`,
    admin_request: 'Admin request',
    staff: 'Staff report',
    admin: 'Admin report',
  };
  return map[inc.source] || inc.source;
}

function shortRef(id: string): string {
  return id.split('-')[0].toUpperCase();
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ── Detail row ── */

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <tr className={highlight ? 'detail-row detail-row-flag' : 'detail-row'}>
      <td className="detail-label">{label}</td>
      <td className="detail-value">{value}</td>
    </tr>
  );
}

function YesNo(v: unknown): string {
  return v === true ? 'Yes' : 'No';
}

/* ── Print content ── */

function PrintContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id') || '';

  const [incident, setIncident] = useState<Incident | null>(null);
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
      if (!id) {
        setError('No incident specified.');
        setLoading(false);
        return;
      }

      const { data, error: fetchErr } = await supabase
        .from('incidents')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr || !data) {
        setError('Incident not found.');
        setLoading(false);
        return;
      }

      setIncident(data as Incident);
      setLoading(false);

      if (searchParams.get('print') === '1') {
        setAutoPrint(true);
      }
    }
    init();
  }, [id, searchParams]);

  useEffect(() => {
    if (!loading && !error && autoPrint && incident) {
      setTimeout(() => window.print(), 600);
    }
  }, [loading, error, autoPrint, incident]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', color: '#666' }}>
        Loading incident…
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', color: '#c0392b' }}>
        {error || 'Incident not found.'}
      </div>
    );
  }

  const inc = incident;
  const isInjury = inc.incident_type === 'injury';
  const fd = inc.form_data || {};
  const str = (k: string) => (typeof fd[k] === 'string' ? (fd[k] as string).trim() : '');
  const riddor = fd['riddor_reportable'] === true;

  const docType = isInjury ? 'Injury — Accident Report' : 'Operational';

  return (
    <>
      {/* Screen-only print toolbar */}
      <div className="print-toolbar no-print">
        <div className="toolbar-info">
          <strong>Incident {shortRef(inc.id)}</strong>
          {' '}· {inc.attraction_name}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="back-btn" onClick={() => window.close()}>Back</button>
          <button className="print-btn" onClick={() => window.print()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="print-container">
        <div className="incident-page">

          {/* ── Header ── */}
          <div className="page-header">
            <div className="page-header-left">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-print.png" alt="Immersive Core" className="header-logo" />
              <div>
                <div className="header-company">Immersive Core</div>
                <div className="header-doc-type">Incident Report</div>
              </div>
            </div>
            <div className="page-header-right">
              <div className="header-date">{formatDate(inc.log_date)}</div>
              <div className="header-ref">Ref {shortRef(inc.id)}</div>
            </div>
          </div>

          <div className="header-rule" />
          <h1 className="incident-title">{inc.attraction_name}</h1>

          {/* ── Details block ── */}
          <div className="section">
            <h2 className="section-title">Record Details</h2>
            <table className="detail-table">
              <tbody>
                <Row label="Type" value={docType} />
                {inc.category && <Row label="Category" value={inc.category} />}
                {inc.severity && <Row label="Severity" value={titleCase(inc.severity)} />}
                <Row label="Status" value={titleCase(inc.status)} />
                <Row label="Source" value={sourceLabel(inc)} />
                {inc.reported_by && <Row label="Reported by" value={inc.reported_by} />}
                <Row label="Logged at" value={formatTs(inc.created_at)} />
                {inc.reviewed_by && (
                  <Row label="Reviewed by" value={`${inc.reviewed_by}${inc.reviewed_at ? ` · ${formatTs(inc.reviewed_at)}` : ''}`} />
                )}
              </tbody>
            </table>
          </div>

          {/* ── What happened ── */}
          <div className="section">
            <h2 className="section-title">What Happened</h2>
            <p className="freetext">{inc.description || '—'}</p>
          </div>

          {/* ── Injury / HSE section ── */}
          {isInjury ? (
            <div className="section">
              <h2 className="section-title">Accident Details</h2>
              <table className="detail-table">
                <tbody>
                  <Row
                    label="Injured person"
                    value={[str('injured_person') || '—', str('person_type') && `(${str('person_type')})`].filter(Boolean).join(' ')}
                  />
                  <Row label="Nature of injury" value={str('injury_nature') || '—'} />
                  <Row label="Body part" value={str('body_part') || '—'} />
                  <Row
                    label="First aid given"
                    value={fd['first_aid_given'] === true ? `Yes${str('first_aider') ? ` — ${str('first_aider')}` : ''}` : 'No'}
                  />
                  <Row label="Taken to hospital" value={YesNo(fd['taken_to_hospital'])} />
                  <Row label="Ambulance called" value={YesNo(fd['ambulance_called'])} />
                  <Row label="RIDDOR reportable" value={YesNo(riddor)} highlight={riddor} />
                  <Row label="Witnesses" value={str('witnesses') || '—'} />
                </tbody>
              </table>
              {riddor && (
                <div className="riddor-flag">
                  RIDDOR reportable — may require notifying the HSE.
                </div>
              )}
            </div>
          ) : (
            <div className="section">
              <h2 className="section-title">Operational Details</h2>
              <table className="detail-table">
                <tbody>
                  <Row label="People involved" value={inc.people_involved || '—'} />
                  <Row label="Actions taken" value={inc.actions_taken || '—'} />
                </tbody>
              </table>
            </div>
          )}

          {/* ── Signature / physical sign-off footer ── */}
          <div className="section sign-section">
            <h2 className="section-title">Sign-Off</h2>
            <div className="sign-grid">
              <div className="sign-line">
                <div className="sign-rule" />
                <div className="sign-label">Signed</div>
              </div>
              <div className="sign-line">
                <div className="sign-rule" />
                <div className="sign-label">Date</div>
              </div>
              <div className="sign-line sign-line-wide">
                <div className="sign-rule" />
                <div className="sign-label">Manager review</div>
              </div>
            </div>
          </div>

          {/* ── Document footer ── */}
          <div className="doc-footer">
            <span>Immersive Core — Confidential</span>
            <span>{inc.attraction_name} · Ref {shortRef(inc.id)}</span>
          </div>

        </div>
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
        .back-btn {
          background: transparent; color: #ccc; border: 1px solid #444;
          border-radius: 6px; padding: 8px 18px; font-size: 13px; font-weight: 600;
          cursor: pointer;
        }
        .back-btn:hover { background: #2a2a2a; }

        /* ── Print container ── */
        .print-container { padding: 24px; }

        .incident-page {
          background: #fff;
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          box-shadow: 0 2px 12px rgba(0,0,0,0.12);
          padding: 18mm 20mm 14mm;
        }

        /* ── Header ── */
        .page-header {
          display: flex; align-items: flex-start;
          justify-content: space-between; margin-bottom: 8px;
        }
        .page-header-left { display: flex; align-items: center; gap: 12px; }
        .header-logo { width: 36px; height: 36px; object-fit: contain; }
        .header-company { font-size: 14pt; font-weight: 700; color: #111; line-height: 1.1; }
        .header-doc-type { font-size: 9pt; color: #888; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
        .page-header-right { text-align: right; }
        .header-date { font-size: 10pt; font-weight: 600; color: #333; }
        .header-ref { font-size: 9pt; color: #888; margin-top: 2px; font-family: monospace; letter-spacing: 0.04em; }
        .header-rule { border: none; border-top: 2px solid #111; margin: 8px 0 14px; }

        .incident-title {
          font-size: 22pt; font-weight: 800; color: #111;
          margin: 0 0 18px; letter-spacing: -0.02em;
        }

        /* ── Sections ── */
        .section { margin-bottom: 18px; page-break-inside: avoid; break-inside: avoid; }
        .section-title {
          font-size: 10pt; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.06em; color: #444;
          margin: 0 0 8px; padding-bottom: 4px;
          border-bottom: 1px solid #e8e8e8;
          page-break-after: avoid; break-after: avoid;
        }

        /* ── Detail tables ── */
        .detail-table { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
        .detail-row td { padding: 7px 8px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
        .detail-label {
          width: 38%; font-size: 9pt; font-weight: 600; color: #888;
          text-transform: uppercase; letter-spacing: 0.03em;
        }
        .detail-value { color: #111; font-weight: 500; }
        .detail-row-flag .detail-value { color: #c0392b; font-weight: 700; }

        /* ── Free text ── */
        .freetext {
          font-size: 10.5pt; color: #222; line-height: 1.55;
          white-space: pre-wrap; margin: 0;
        }

        /* ── RIDDOR flag ── */
        .riddor-flag {
          margin-top: 12px; padding: 8px 12px;
          border: 1.5px solid #c0392b; border-radius: 4px;
          background: #fbeae8; color: #c0392b;
          font-size: 10pt; font-weight: 700;
        }

        /* ── Sign-off footer ── */
        .sign-section { margin-top: 28px; }
        .sign-grid { display: flex; flex-wrap: wrap; gap: 24px; margin-top: 18px; }
        .sign-line { flex: 1; min-width: 200px; }
        .sign-line-wide { flex-basis: 100%; }
        .sign-rule { border-bottom: 1px solid #333; height: 28px; }
        .sign-label {
          font-size: 8.5pt; color: #888; margin-top: 5px;
          text-transform: uppercase; letter-spacing: 0.05em;
        }

        /* ── Document footer ── */
        .doc-footer {
          display: flex; justify-content: space-between;
          font-size: 8pt; color: #bbb;
          border-top: 1px solid #eee;
          padding-top: 8px; margin-top: 32px;
        }

        /* ── Print media ── */
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
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
          .print-container { padding: 0; }
          .incident-page {
            box-shadow: none;
            margin: 0;
            width: 100%;
            min-height: auto;
          }
        }
      `}</style>
    </>
  );
}

export default function IncidentPrintPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', color: '#666' }}>Loading…</div>}>
      <PrintContent />
    </Suspense>
  );
}
