'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkAuth, clearAuthCache } from '@/lib/auth';
import AdminNav from '@/components/AdminNav';
import type { Incident, IncidentStatus, IncidentSeverity, Attraction } from '@/types/database';
import { surface, border, text as textTok, accents, radius, FONT_NUM, microLabel, primaryButton, controlButton } from '@/lib/theme';
import { useToasts, ToastStack } from '@/components/ui/Toast';
import { getTodayDateStr } from '@/lib/signoff';
import IncidentForm, { type IncidentFormValues } from '@/components/IncidentForm';

type FilterKey = 'submitted' | 'requested' | 'all';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'submitted', label: 'To review' },
  { key: 'requested', label: 'Awaiting operator' },
  { key: 'all', label: 'All' },
];

const SEVERITY_RAIL: Record<string, string> = {
  serious: '#EF4444',
  moderate: '#F59E0B',
  minor: '#22C55E',
};
function severityRail(sev: IncidentSeverity | null): string {
  return (sev && SEVERITY_RAIL[sev]) || '#64748B';
}

const SEVERITY_PILL: Record<string, { bg: string; text: string }> = {
  serious: { bg: 'rgba(239,68,68,0.12)', text: '#F87171' },
  moderate: { bg: 'rgba(245,158,11,0.12)', text: '#FBBF24' },
  minor: { bg: 'rgba(34,197,94,0.12)', text: '#4ADE80' },
};

const STATUS_PILL: Record<IncidentStatus, { bg: string; text: string; label: string }> = {
  requested: { bg: 'rgba(148,163,184,0.12)', text: '#94A3B8', label: 'Requested' },
  submitted: { bg: 'rgba(59,130,246,0.12)', text: '#93C5FD', label: 'Submitted' },
  reviewed: { bg: 'rgba(34,197,94,0.12)', text: '#4ADE80', label: 'Reviewed' },
  dismissed: { bg: 'rgba(100,116,139,0.12)', text: '#64748B', label: 'Dismissed' },
};

function sourceLabel(inc: Incident): string {
  if (inc.source === 'operator') return 'Operator report';
  if (inc.source === 'delay_auto') return `Auto: ${inc.delay_reason || 'unspecified'} delay`;
  if (inc.source === 'staff') return 'Staff report';
  if (inc.source === 'admin') return 'Admin report';
  return 'Admin request';
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function Pill({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px', borderRadius: radius.pill,
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
      background: bg, color,
    }}>
      {children}
    </span>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <p style={{ ...microLabel, margin: '0 0 3px' }}>{label}</p>
      <p style={{ color: textTok.primary, fontSize: 13, lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>{value}</p>
    </div>
  );
}

/** Renders the structured HSE accident fields stored in incidents.form_data. */
function InjuryDetails({ data }: { data: Record<string, unknown> }) {
  const str = (k: string) => (typeof data[k] === 'string' ? (data[k] as string).trim() : '');
  const bool = (k: string) => data[k] === true;
  const injured = str('injured_person');
  const personType = str('person_type');
  const rows: [string, string][] = [
    ['Injured person', [injured, personType && `(${personType})`].filter(Boolean).join(' ')],
    ['Nature of injury', str('injury_nature')],
    ['Body part', str('body_part')],
    ['First aid', bool('first_aid_given') ? `Yes${str('first_aider') ? ` — ${str('first_aider')}` : ''}` : 'No'],
    ['Taken to hospital', bool('taken_to_hospital') ? 'Yes' : 'No'],
    ['Ambulance called', bool('ambulance_called') ? 'Yes' : 'No'],
    ['Witnesses', str('witnesses')],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {rows.map(([label, value]) => (
          <div key={label}>
            <p style={{ ...microLabel, margin: '0 0 2px' }}>{label}</p>
            <p style={{ color: textTok.primary, fontSize: 13, lineHeight: 1.4, margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>
      {bool('riddor_reportable') && (
        <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#FCA5A5', fontSize: 12, fontWeight: 600 }}>
          ⚠ Flagged RIDDOR reportable — may require notifying the HSE
        </div>
      )}
    </div>
  );
}

export default function IncidentsPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filter, setFilter] = useState<FilterKey>('submitted');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [attractions, setAttractions] = useState<Pick<Attraction, 'id' | 'name' | 'slug'>[]>([]);
  const [creating, setCreating] = useState(false);
  // null = picker closed; '' = picker open, awaiting choice; otherwise chosen attraction id or 'general'
  const [chosenAttraction, setChosenAttraction] = useState<string | null>(null);
  const { toasts, pushToast } = useToasts();

  const fetchIncidents = useCallback(async () => {
    const { data, error } = await supabase
      .from('incidents')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      if (process.env.NODE_ENV === 'development') console.error('Error fetching incidents:', error);
      return;
    }
    setIncidents(data || []);
  }, []);

  useEffect(() => {
    async function init() {
      const auth = await checkAuth();
      if (!auth.authenticated || auth.role !== 'admin') {
        window.location.href = '/login';
        return;
      }
      setUserEmail(auth.email || '');
      setDisplayName(auth.displayName || '');
      await fetchIncidents();
      const { data: attrs } = await supabase
        .from('attractions')
        .select('id, name, slug')
        .order('sort_order', { ascending: true });
      setAttractions(attrs || []);
      setLoading(false);
    }
    init();

    const channel = supabase
      .channel('admin-incidents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, () => {
        fetchIncidents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleLogout() {
    clearAuthCache(); await supabase.auth.signOut();
    window.location.href = '/login';
  }

  const submittedCount = incidents.filter((i) => i.status === 'submitted').length;

  const visible = incidents.filter((inc) => {
    if (filter === 'all') return true;
    return inc.status === filter;
  });

  async function markReviewed(inc: Incident) {
    setBusyId(inc.id);
    const reviewer = displayName || userEmail;
    const { error } = await supabase
      .from('incidents')
      .update({ status: 'reviewed', reviewed_by: reviewer, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', inc.id);
    setBusyId(null);
    if (error) {
      pushToast('error', `Failed to mark ${inc.attraction_name} reviewed`);
      return;
    }
    pushToast('success', 'Incident marked reviewed');
  }

  async function reopen(inc: Incident) {
    setBusyId(inc.id);
    const { error } = await supabase
      .from('incidents')
      .update({ status: 'submitted', reviewed_by: null, reviewed_at: null, updated_at: new Date().toISOString() })
      .eq('id', inc.id);
    setBusyId(null);
    if (error) {
      pushToast('error', `Failed to reopen ${inc.attraction_name}`);
      return;
    }
    pushToast('success', 'Incident reopened');
  }

  const chosenAttractionName =
    chosenAttraction && chosenAttraction !== 'general'
      ? attractions.find((a) => a.id === chosenAttraction)?.name || 'General'
      : 'General';

  async function createIncident(values: IncidentFormValues) {
    const attractionId = chosenAttraction && chosenAttraction !== 'general' ? chosenAttraction : null;
    const { error } = await supabase.from('incidents').insert({
      source: 'admin',
      status: 'submitted',
      attraction_id: attractionId,
      attraction_name: chosenAttractionName,
      log_date: getTodayDateStr(),
      incident_type: values.incident_type,
      category: values.category,
      severity: values.severity,
      description: values.description,
      people_involved: values.people_involved,
      actions_taken: values.actions_taken,
      form_data: values.form_data,
      reported_by: displayName || userEmail,
    });
    if (error) {
      pushToast('error', 'Failed to log incident');
      throw error;
    }
    pushToast('success', 'Incident logged');
    setCreating(false);
    setChosenAttraction(null);
    await fetchIncidents();
  }

  async function cancelRequest(inc: Incident) {
    setBusyId(inc.id);
    const { error } = await supabase
      .from('incidents')
      .delete()
      .eq('id', inc.id);
    setBusyId(null);
    if (error) {
      pushToast('error', `Failed to cancel request for ${inc.attraction_name}`);
      return;
    }
    pushToast('success', 'Request cancelled');
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: surface.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-white text-xl font-semibold animate-pulse">Loading...</div>
      </div>
    );
  }

  const emptyMessage =
    filter === 'submitted' ? 'No incidents awaiting review.'
    : filter === 'requested' ? 'No reports awaiting an operator.'
    : 'No incidents recorded.';

  return (
    <div style={{ minHeight: '100vh', background: surface.page, color: textTok.primary }}>
      <AdminNav userEmail={userEmail} displayName={displayName} onLogout={handleLogout} />

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '0 0 20px' }}>
          <h2 className="text-2xl font-bold" style={{ margin: 0 }}>Incident Review</h2>
          <button
            onClick={() => { setChosenAttraction('general'); setCreating(true); }}
            style={{ ...primaryButton('admin'), display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', fontSize: 13 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New incident
          </button>
        </div>

        {/* Segmented filter */}
        <div style={{ display: 'inline-flex', gap: 2, background: surface.control, border: `1px solid ${border.strong}`, borderRadius: radius.md, padding: 3, marginBottom: 24 }}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: radius.sm, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                  background: active ? accents.admin.strong : 'transparent',
                  color: active ? '#fff' : textTok.secondary,
                  transition: 'all 0.15s',
                }}
              >
                {f.label}
                {f.key === 'submitted' && submittedCount > 0 && (
                  <span style={{
                    minWidth: 18, height: 18, padding: '0 5px', borderRadius: radius.pill,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, ...FONT_NUM,
                    background: active ? 'rgba(0,0,0,0.25)' : accents.admin.strong,
                    color: '#fff',
                  }}>
                    {submittedCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Cards */}
        {visible.length === 0 ? (
          <div style={{ background: surface.card, border: `1px solid ${border.default}`, borderRadius: radius.lg, padding: '48px 24px', textAlign: 'center' }}>
            <p style={{ color: textTok.muted, fontSize: 14, margin: 0 }}>{emptyMessage}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {visible.map((inc) => {
              const isRequested = inc.status === 'requested';
              return (
                <div
                  key={inc.id}
                  style={{
                    background: surface.card,
                    border: `1px solid ${border.default}`,
                    borderLeft: `3px solid ${severityRail(inc.severity)}`,
                    borderTopLeftRadius: 0,
                    borderBottomLeftRadius: 0,
                    borderRadius: radius.xl,
                    padding: 18,
                  }}
                >
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ color: textTok.primary, fontSize: 15, fontWeight: 700 }}>{inc.attraction_name}</span>
                      {inc.category && <span style={{ color: textTok.secondary, fontSize: 13 }}>· {inc.category}</span>}
                      <Pill bg={STATUS_PILL[inc.status].bg} color={STATUS_PILL[inc.status].text}>{STATUS_PILL[inc.status].label}</Pill>
                      {inc.severity && (
                        <Pill bg={SEVERITY_PILL[inc.severity].bg} color={SEVERITY_PILL[inc.severity].text}>{inc.severity}</Pill>
                      )}
                    </div>
                    <span style={{ color: textTok.muted, fontSize: 12, ...FONT_NUM, whiteSpace: 'nowrap' }}>{formatTime(inc.created_at)}</span>
                  </div>

                  {/* Source */}
                  <p style={{ ...microLabel, margin: '8px 0 0' }}>{sourceLabel(inc)}</p>

                  {/* Body */}
                  {isRequested ? (
                    <p style={{ color: textTok.muted, fontSize: 13, fontStyle: 'italic', margin: '12px 0 0' }}>
                      Awaiting operator report
                    </p>
                  ) : (
                    <>
                      {inc.incident_type === 'injury' && (
                        <div style={{ display: 'inline-block', marginTop: 10, marginBottom: 2, padding: '3px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                          Accident report
                        </div>
                      )}
                      <Field label={inc.incident_type === 'injury' ? 'How it happened' : 'Description'} value={inc.description} />
                      {inc.incident_type === 'injury' ? (
                        <InjuryDetails data={inc.form_data} />
                      ) : (
                        <>
                          <Field label="People involved" value={inc.people_involved} />
                          <Field label="Actions taken" value={inc.actions_taken} />
                        </>
                      )}
                      {inc.reported_by && (
                        <p style={{ color: textTok.muted, fontSize: 12, margin: '12px 0 0' }}>
                          Reported by {inc.reported_by}
                        </p>
                      )}
                    </>
                  )}

                  {inc.status === 'reviewed' && inc.reviewed_by && (
                    <p style={{ color: '#4ADE80', fontSize: 12, margin: '12px 0 0' }}>
                      Reviewed by {inc.reviewed_by}{inc.reviewed_at ? ` · ${formatTime(inc.reviewed_at)}` : ''}
                    </p>
                  )}

                  {/* Actions */}
                  {(inc.status === 'submitted' || inc.status === 'reviewed' || inc.status === 'requested' || inc.status === 'dismissed') && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${border.divider}` }}>
                      {!isRequested && (
                        <a
                          href={`/admin/incidents/print?id=${inc.id}&print=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ ...controlButton, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <polyline points="6 9 6 2 18 2 18 9" />
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                            <rect x="6" y="14" width="12" height="8" />
                          </svg>
                          Print
                        </a>
                      )}
                      {inc.status === 'submitted' && (
                        <button
                          onClick={() => markReviewed(inc)}
                          disabled={busyId === inc.id}
                          style={{
                            padding: '8px 16px', background: accents.admin.strong, border: 'none', borderRadius: radius.md,
                            color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: busyId === inc.id ? 0.5 : 1,
                          }}
                        >
                          {busyId === inc.id ? 'Saving…' : 'Mark reviewed'}
                        </button>
                      )}
                      {inc.status === 'reviewed' && (
                        <button
                          onClick={() => reopen(inc)}
                          disabled={busyId === inc.id}
                          style={{
                            padding: '8px 16px', background: surface.control, border: `1px solid ${border.strong}`, borderRadius: radius.md,
                            color: textTok.secondary, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: busyId === inc.id ? 0.5 : 1,
                          }}
                        >
                          {busyId === inc.id ? 'Saving…' : 'Reopen'}
                        </button>
                      )}
                      {inc.status === 'requested' && (
                        <button
                          onClick={() => cancelRequest(inc)}
                          disabled={busyId === inc.id}
                          style={{
                            padding: '8px 16px', background: 'transparent', border: `1px solid ${border.strong}`, borderRadius: radius.md,
                            color: textTok.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: busyId === inc.id ? 0.5 : 1,
                          }}
                        >
                          {busyId === inc.id ? 'Cancelling…' : 'Cancel request'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New incident: attraction picker → shared form */}
      {creating && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={() => { setCreating(false); setChosenAttraction(null); }}
          >
            <div
              style={{ width: '100%', maxWidth: 420, background: surface.card, border: `1px solid ${border.default}`, borderRadius: radius.xl, padding: 24 }}
              onClick={(e) => e.stopPropagation()}
            >
              <p style={{ color: textTok.primary, fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>New incident</p>
              <p style={{ color: textTok.muted, fontSize: 12, margin: '0 0 16px' }}>Choose the attraction this relates to.</p>
              <p style={{ ...microLabel, marginBottom: 8 }}>Attraction</p>
              <select
                value={chosenAttraction || 'general'}
                onChange={(e) => setChosenAttraction(e.target.value)}
                style={{ width: '100%', background: surface.control, border: `1px solid ${border.strong}`, borderRadius: radius.md, color: textTok.primary, fontSize: 14, padding: '10px 12px', outline: 'none' }}
              >
                <option value="general">General</option>
                {attractions.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button
                  onClick={() => { setCreating(false); setChosenAttraction(null); }}
                  style={{ ...controlButton, flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => setCreating(false)}
                  style={{ ...primaryButton('admin'), flex: 2, padding: '11px 0', fontSize: 14 }}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Once an attraction is chosen and the picker is dismissed, render the shared form */}
      {!creating && chosenAttraction !== null && (
        <IncidentForm
          attractionName={chosenAttractionName}
          onSubmit={createIncident}
          onCancel={() => setChosenAttraction(null)}
        />
      )}

      <ToastStack toasts={toasts} />
    </div>
  );
}
