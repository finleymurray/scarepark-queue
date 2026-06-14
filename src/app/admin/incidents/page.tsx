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

const OWNER_EMAIL = 'finley@immersivecore.network';

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

/** A grid of label/value rows; empties are filtered out. */
function DetailGrid({ rows }: { rows: [string, string][] }) {
  const filtered = rows.filter(([, v]) => v) as [string, string][];
  if (filtered.length === 0) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
      {filtered.map(([label, value]) => (
        <div key={label}>
          <p style={{ ...microLabel, margin: '0 0 2px' }}>{label}</p>
          <p style={{ color: textTok.primary, fontSize: 13, lineHeight: 1.4, margin: 0, whiteSpace: 'pre-wrap' }}>{value}</p>
        </div>
      ))}
    </div>
  );
}

function fdStr(data: Record<string, unknown>, k: string): string {
  return typeof data[k] === 'string' ? (data[k] as string).trim() : '';
}

/** Structured witness block, shared by injury and operational reports. */
function WitnessDetails({ data }: { data: Record<string, unknown> }) {
  if (data['witness_present'] !== true) return null;
  const name = fdStr(data, 'witness_name');
  const who = fdStr(data, 'witness_is');
  const rows: [string, string][] =
    who === 'employee'
      ? [
          ['Witness', name],
          ['Witness employee ID', fdStr(data, 'witness_employee_id')],
          ['Witness role', fdStr(data, 'witness_job_role')],
        ]
      : [
          ['Witness', name],
          ['Witness phone', fdStr(data, 'witness_phone')],
          ['Witness email', fdStr(data, 'witness_email')],
        ];
  if (!rows.some(([, v]) => v)) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ ...microLabel, margin: '0 0 6px' }}>Witness ({who === 'employee' ? 'employee' : 'member of public'})</p>
      <DetailGrid rows={rows} />
    </div>
  );
}

/** Renders the structured HSE accident fields stored in incidents.form_data. */
function InjuryDetails({ data }: { data: Record<string, unknown> }) {
  const str = (k: string) => fdStr(data, k);
  const bool = (k: string) => data[k] === true;
  const injured = str('injured_person');
  const personType = str('person_type');
  const isStaff = personType === 'Staff';
  const clinicalRows: [string, string][] = [
    ['Injured person', [injured, personType && `(${personType})`].filter(Boolean).join(' ')],
    ['Nature of injury', str('injury_nature')],
    ['Body part', str('body_part')],
    ['First aid', bool('first_aid_given') ? `Yes${str('first_aider') ? ` — ${str('first_aider')}` : ''}` : 'No'],
    ['Taken to hospital', bool('taken_to_hospital') ? 'Yes' : 'No'],
    ['Ambulance called', bool('ambulance_called') ? 'Yes' : 'No'],
  ];
  const contactRows: [string, string][] = isStaff
    ? [
        ['Employee ID', str('employee_id')],
        ['Job role', str('job_role')],
      ]
    : [
        ['Contact email', str('contact_email')],
        ['Contact phone', str('contact_phone')],
        ['Address', str('contact_address')],
      ];

  return (
    <div style={{ marginTop: 12 }}>
      <DetailGrid rows={clinicalRows} />
      {contactRows.some(([, v]) => v) && (
        <div style={{ marginTop: 12 }}>
          <p style={{ ...microLabel, margin: '0 0 6px' }}>{isStaff ? 'Staff details' : 'Contact details'}</p>
          <DetailGrid rows={contactRows} />
        </div>
      )}
      <WitnessDetails data={data} />
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
  const [savingReviewId, setSavingReviewId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // Per-incident manager editor drafts, keyed by incident id.
  const [editors, setEditors] = useState<Record<string, { manager_actions: string; remediation: string; riddor_reportable: boolean | null }>>({});

  const isOwner = userEmail === OWNER_EMAIL;

  function patchLocal(id: string, patch: Partial<Incident>) {
    setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }
  function removeLocal(id: string) {
    setIncidents((prev) => prev.filter((i) => i.id !== id));
  }
  function editorFor(inc: Incident) {
    return (
      editors[inc.id] || {
        manager_actions: inc.manager_actions || '',
        remediation: inc.remediation || '',
        riddor_reportable: inc.riddor_reportable,
      }
    );
  }
  function setEditor(id: string, patch: Partial<{ manager_actions: string; remediation: string; riddor_reportable: boolean | null }>) {
    setEditors((prev) => {
      const cur = prev[id] || { manager_actions: '', remediation: '', riddor_reportable: null };
      return { ...prev, [id]: { ...cur, ...patch } };
    });
  }
  const [attractions, setAttractions] = useState<Pick<Attraction, 'id' | 'name' | 'slug'>[]>([]);
  const [creating, setCreating] = useState(false);
  // null = picker closed; '' = picker open, awaiting choice; otherwise chosen attraction id or 'general'
  const [chosenAttraction, setChosenAttraction] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);   // ad-hoc "request report" picker open
  const [reqAttraction, setReqAttraction] = useState(''); // chosen attraction for the request
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
    const reviewedAt = new Date().toISOString();
    // Persist any unsaved manager editor values alongside the status change.
    const draft = editorFor(inc);
    const { error } = await supabase
      .from('incidents')
      .update({
        status: 'reviewed',
        reviewed_by: reviewer,
        reviewed_at: reviewedAt,
        manager_actions: draft.manager_actions || null,
        remediation: draft.remediation || null,
        riddor_reportable: draft.riddor_reportable,
        updated_at: reviewedAt,
      })
      .eq('id', inc.id);
    setBusyId(null);
    if (error) {
      pushToast('error', `Failed to mark ${inc.attraction_name} reviewed`);
      return;
    }
    patchLocal(inc.id, {
      status: 'reviewed',
      reviewed_by: reviewer,
      reviewed_at: reviewedAt,
      manager_actions: draft.manager_actions || null,
      remediation: draft.remediation || null,
      riddor_reportable: draft.riddor_reportable,
    });
    pushToast('success', 'Incident marked reviewed');
  }

  async function saveReview(inc: Incident) {
    const draft = editorFor(inc);
    setSavingReviewId(inc.id);
    const { error } = await supabase
      .from('incidents')
      .update({
        manager_actions: draft.manager_actions || null,
        remediation: draft.remediation || null,
        riddor_reportable: draft.riddor_reportable,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inc.id);
    setSavingReviewId(null);
    if (error) {
      pushToast('error', 'Failed to save manager review');
      return;
    }
    patchLocal(inc.id, {
      manager_actions: draft.manager_actions || null,
      remediation: draft.remediation || null,
      riddor_reportable: draft.riddor_reportable,
    });
    pushToast('success', 'Manager review saved');
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
    patchLocal(inc.id, { status: 'submitted', reviewed_by: null, reviewed_at: null });
    pushToast('success', 'Incident reopened');
  }

  async function deleteIncident(inc: Incident) {
    setBusyId(inc.id);
    const { error } = await supabase.from('incidents').delete().eq('id', inc.id);
    setBusyId(null);
    setConfirmDeleteId(null);
    if (error) {
      pushToast('error', `Failed to delete ${inc.attraction_name}`);
      return;
    }
    removeLocal(inc.id);
    pushToast('success', 'Incident deleted');
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

  // Ad-hoc: send a report request to Control for an attraction (no delay needed).
  async function sendRequestReport() {
    const id = reqAttraction;
    const name = attractions.find((a) => a.id === id)?.name;
    if (!id || !name) { pushToast('error', 'Pick an attraction'); return; }
    if (incidents.some((i) => i.attraction_id === id && i.status === 'requested')) {
      pushToast('error', `A report is already pending for ${name}`);
      setRequesting(false);
      return;
    }
    const { error } = await supabase.from('incidents').insert({
      source: 'admin_request',
      status: 'requested',
      attraction_id: id,
      attraction_name: name,
      requested_by: displayName || userEmail,
      log_date: getTodayDateStr(),
    });
    if (error) { pushToast('error', 'Failed to send request'); return; }
    pushToast('success', `Report requested from Control for ${name}`);
    setRequesting(false);
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
    removeLocal(inc.id);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => { setReqAttraction(attractions[0]?.id || ''); setRequesting(true); }}
              style={{ ...controlButton, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', fontSize: 13, fontWeight: 600 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 4h16v12H4z" /><path d="M8 20h8M12 16v4" />
              </svg>
              Request report
            </button>
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
                      {inc.incident_type === 'injury' && inc.status !== 'requested' && (
                        inc.riddor_reportable === null ? (
                          <Pill bg="rgba(245,158,11,0.14)" color="#FBBF24">RIDDOR: not assessed</Pill>
                        ) : inc.riddor_reportable === true ? (
                          <Pill bg="rgba(239,68,68,0.14)" color="#F87171">RIDDOR reportable</Pill>
                        ) : (
                          <Pill bg="rgba(148,163,184,0.12)" color="#94A3B8">Not RIDDOR</Pill>
                        )
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
                      <Field label="Location" value={fdStr(inc.form_data, 'location') || null} />
                      <Field label={inc.incident_type === 'injury' ? 'How it happened' : 'Description'} value={inc.description} />
                      {inc.incident_type === 'injury' ? (
                        <InjuryDetails data={inc.form_data} />
                      ) : (
                        <>
                          <Field label="People involved" value={inc.people_involved} />
                          <Field label="Actions taken" value={inc.actions_taken} />
                          <WitnessDetails data={inc.form_data} />
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

                  {/* Manager review editor (submitted + reviewed) */}
                  {(inc.status === 'submitted' || inc.status === 'reviewed') && (() => {
                    const draft = editorFor(inc);
                    const segOpts: { val: boolean | null; label: string; activeBg: string; activeColor: string }[] = [
                      { val: null, label: 'Not assessed', activeBg: 'rgba(245,158,11,0.2)', activeColor: '#FBBF24' },
                      { val: true, label: 'RIDDOR reportable', activeBg: 'rgba(239,68,68,0.2)', activeColor: '#F87171' },
                      { val: false, label: 'Not reportable', activeBg: 'rgba(148,163,184,0.2)', activeColor: '#CBD5E1' },
                    ];
                    const taStyle: React.CSSProperties = {
                      width: '100%', marginTop: 4, background: surface.control, border: `1px solid ${border.strong}`,
                      borderRadius: radius.md, color: textTok.primary, fontSize: 13, padding: '8px 10px',
                      outline: 'none', resize: 'vertical', minHeight: 54, fontFamily: 'inherit',
                    };
                    return (
                      <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${border.divider}` }}>
                        <p style={{ ...microLabel, margin: '0 0 8px' }}>Manager review</p>
                        <div>
                          <label style={{ ...microLabel, fontWeight: 600 }}>Manager action taken</label>
                          <textarea
                            value={draft.manager_actions}
                            onChange={(e) => setEditor(inc.id, { manager_actions: e.target.value })}
                            style={taStyle}
                          />
                        </div>
                        <div style={{ marginTop: 10 }}>
                          <label style={{ ...microLabel, fontWeight: 600 }}>Remediation / prevention</label>
                          <textarea
                            value={draft.remediation}
                            onChange={(e) => setEditor(inc.id, { remediation: e.target.value })}
                            style={taStyle}
                          />
                        </div>
                        {inc.incident_type === 'injury' && (
                          <div style={{ marginTop: 10 }}>
                            <label style={{ ...microLabel, fontWeight: 600 }}>RIDDOR determination</label>
                            <div style={{ display: 'inline-flex', gap: 2, marginTop: 4, background: surface.control, border: `1px solid ${border.strong}`, borderRadius: radius.md, padding: 3, flexWrap: 'wrap' }}>
                              {segOpts.map((o) => {
                                const active = draft.riddor_reportable === o.val;
                                return (
                                  <button
                                    key={o.label}
                                    onClick={() => setEditor(inc.id, { riddor_reportable: o.val })}
                                    style={{
                                      padding: '6px 12px', borderRadius: radius.sm, border: 'none', cursor: 'pointer',
                                      fontSize: 12, fontWeight: 600,
                                      background: active ? o.activeBg : 'transparent',
                                      color: active ? o.activeColor : textTok.secondary,
                                    }}
                                  >
                                    {o.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <div style={{ marginTop: 12 }}>
                          <button
                            onClick={() => saveReview(inc)}
                            disabled={savingReviewId === inc.id}
                            style={{
                              padding: '8px 16px', background: surface.control, border: `1px solid ${border.strong}`, borderRadius: radius.md,
                              color: textTok.primary, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: savingReviewId === inc.id ? 0.5 : 1,
                            }}
                          >
                            {savingReviewId === inc.id ? 'Saving…' : 'Save review'}
                          </button>
                        </div>
                      </div>
                    );
                  })()}

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
                      {isOwner && (
                        <button
                          onClick={() => {
                            if (confirmDeleteId === inc.id) deleteIncident(inc);
                            else setConfirmDeleteId(inc.id);
                          }}
                          onBlur={() => setConfirmDeleteId((cur) => (cur === inc.id ? null : cur))}
                          disabled={busyId === inc.id}
                          style={{
                            marginLeft: 'auto',
                            padding: '8px 14px', background: 'transparent',
                            border: `1px solid ${confirmDeleteId === inc.id ? '#EF4444' : border.strong}`,
                            borderRadius: radius.md,
                            color: confirmDeleteId === inc.id ? '#F87171' : textTok.muted,
                            fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: busyId === inc.id ? 0.5 : 1,
                          }}
                        >
                          {busyId === inc.id ? 'Deleting…' : confirmDeleteId === inc.id ? 'Confirm delete?' : 'Delete'}
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

      {/* Request report: pick attraction → send a request to Control */}
      {requesting && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setRequesting(false)}
        >
          <div
            style={{ width: '100%', maxWidth: 420, background: surface.card, border: `1px solid ${border.default}`, borderRadius: radius.xl, padding: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ color: textTok.primary, fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>Request a report</p>
            <p style={{ color: textTok.muted, fontSize: 12, margin: '0 0 16px' }}>The operator on this attraction will be prompted on Control to file or dismiss a report.</p>
            <p style={{ ...microLabel, marginBottom: 8 }}>Attraction</p>
            <select
              value={reqAttraction}
              onChange={(e) => setReqAttraction(e.target.value)}
              style={{ width: '100%', background: surface.control, border: `1px solid ${border.strong}`, borderRadius: radius.md, color: textTok.primary, fontSize: 14, padding: '10px 12px', outline: 'none' }}
            >
              {attractions.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setRequesting(false)} style={{ ...controlButton, flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 600 }}>Cancel</button>
              <button onClick={sendRequestReport} style={{ ...primaryButton('admin'), flex: 2, padding: '11px 0', fontSize: 14 }}>Send request</button>
            </div>
          </div>
        </div>
      )}

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
