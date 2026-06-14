'use client';

import { useState } from 'react';
import { surface, border, text, radius, microLabel, primaryButton, controlButton } from '@/lib/theme';
import type { IncidentCategory, IncidentSeverity, IncidentType } from '@/types/database';

const OP_CATEGORIES: IncidentCategory[] = ['Guest behaviour', 'Ejection', 'Near miss', 'Lost child', 'Technical', 'Other'];
const SEVERITIES: { value: IncidentSeverity; label: string; color: string }[] = [
  { value: 'minor', label: 'Minor', color: '#4ADE80' },
  { value: 'moderate', label: 'Moderate', color: '#FBBF24' },
  { value: 'serious', label: 'Serious', color: '#F87171' },
];
const PERSON_TYPES = ['Guest', 'Staff', 'Contractor'] as const;

export interface IncidentFormValues {
  incident_type: IncidentType;
  category: string;
  severity: IncidentSeverity;
  description: string;
  people_involved: string;
  actions_taken: string;
  form_data: Record<string, unknown>;
}

/**
 * Shared incident report form (modal). Branches on incident type:
 *  - Operational: guest issue / downtime — category, what happened, action.
 *  - Injury: a structured HSE-style accident report.
 * Persistence is handled by the caller via onSubmit.
 */
export default function IncidentForm({
  attractionName,
  context,
  onSubmit,
  onCancel,
}: {
  attractionName: string;
  context?: string;
  onSubmit: (values: IncidentFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [type, setType] = useState<IncidentType | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Shared
  const [severity, setSeverity] = useState<IncidentSeverity>('minor');
  const [description, setDescription] = useState('');

  // Operational
  const [category, setCategory] = useState<IncidentCategory>('Guest behaviour');
  const [people, setPeople] = useState('');
  const [actions, setActions] = useState('');

  // Injury (HSE)
  const [injuredName, setInjuredName] = useState('');
  const [personType, setPersonType] = useState<(typeof PERSON_TYPES)[number]>('Guest');
  const [injuryNature, setInjuryNature] = useState('');
  const [bodyPart, setBodyPart] = useState('');
  const [firstAid, setFirstAid] = useState(false);
  const [firstAider, setFirstAider] = useState('');
  const [hospital, setHospital] = useState(false);
  const [ambulance, setAmbulance] = useState(false);
  const [riddor, setRiddor] = useState(false);
  const [witnesses, setWitnesses] = useState('');

  async function submit(values: IncidentFormValues) {
    setBusy(true); setError('');
    try { await onSubmit(values); }
    catch { setError('Failed to submit — try again.'); setBusy(false); }
  }

  function submitOperational() {
    if (!description.trim()) { setError('Please describe what happened.'); return; }
    submit({
      incident_type: 'operational', category, severity,
      description: description.trim(), people_involved: people.trim(), actions_taken: actions.trim(),
      form_data: {},
    });
  }

  function submitInjury() {
    if (!injuredName.trim()) { setError('Enter the injured person’s name.'); return; }
    if (!description.trim()) { setError('Describe how the injury happened.'); return; }
    submit({
      incident_type: 'injury', category: 'Injury', severity,
      description: description.trim(),
      people_involved: `${injuredName.trim()} (${personType})`,
      actions_taken: [firstAid && `First aid by ${firstAider.trim() || 'unnamed'}`, hospital && 'Hospital', ambulance && 'Ambulance called'].filter(Boolean).join(' · '),
      form_data: {
        injured_person: injuredName.trim(),
        person_type: personType,
        injury_nature: injuryNature.trim(),
        body_part: bodyPart.trim(),
        first_aid_given: firstAid,
        first_aider: firstAider.trim(),
        taken_to_hospital: hospital,
        ambulance_called: ambulance,
        riddor_reportable: riddor,
        witnesses: witnesses.trim(),
      },
    });
  }

  return (
    <Shell attractionName={attractionName} context={context} onCancel={onCancel}>
      {/* Step 1 — choose type */}
      {type === null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ ...microLabel, marginBottom: 0 }}>What are you reporting?</p>
          <TypeChoice
            title="Guest issue / downtime"
            body="Behaviour, ejection, near miss, technical fault or operational note."
            accent="#3B82F6"
            onClick={() => { setType('operational'); setError(''); }}
          />
          <TypeChoice
            title="Injury or accident"
            body="A guest or staff member was hurt — opens the full accident report."
            accent="#F87171"
            onClick={() => { setType('injury'); setError(''); }}
          />
        </div>
      )}

      {/* Step 2a — operational */}
      {type === 'operational' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Chips label="Type" options={OP_CATEGORIES} value={category} onChange={(v) => setCategory(v as IncidentCategory)} accent="#3B82F6" />
          <SeverityPicker value={severity} onChange={setSeverity} />
          <Field label="What happened?" value={description} onChange={setDescription} rows={3} placeholder="Describe the incident…" />
          <Field label="People involved (optional)" value={people} onChange={setPeople} rows={2} placeholder="Guests, staff, witnesses…" />
          <Field label="Action taken (optional)" value={actions} onChange={setActions} rows={2} placeholder="Attraction stopped, guest spoken to…" />
          {error && <ErrLine msg={error} />}
          <Actions busy={busy} onBack={() => setType(null)} onSubmit={submitOperational} />
        </div>
      )}

      {/* Step 2b — injury (HSE) */}
      {type === 'injury' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Injured person — name" value={injuredName} onChange={setInjuredName} rows={1} placeholder="Full name" />
          <Chips label="Who" options={[...PERSON_TYPES]} value={personType} onChange={(v) => setPersonType(v as (typeof PERSON_TYPES)[number])} accent="#F87171" />
          <SeverityPicker value={severity} onChange={setSeverity} />
          <Field label="How did it happen?" value={description} onChange={setDescription} rows={3} placeholder="Describe the accident and what they were doing…" />
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}><Field label="Nature of injury" value={injuryNature} onChange={setInjuryNature} rows={1} placeholder="Cut, sprain, bruise…" /></div>
            <div style={{ flex: 1 }}><Field label="Body part" value={bodyPart} onChange={setBodyPart} rows={1} placeholder="Ankle, head…" /></div>
          </div>
          <Toggle label="First aid given?" on={firstAid} onToggle={() => setFirstAid((v) => !v)} />
          {firstAid && <Field label="First aider" value={firstAider} onChange={setFirstAider} rows={1} placeholder="Who administered it" />}
          <Toggle label="Taken to hospital?" on={hospital} onToggle={() => setHospital((v) => !v)} />
          <Toggle label="Ambulance called?" on={ambulance} onToggle={() => setAmbulance((v) => !v)} />
          <Toggle label="RIDDOR reportable?" on={riddor} onToggle={() => setRiddor((v) => !v)} hint="Death, specified injuries, or >7-day incapacitation" />
          <Field label="Witnesses (optional)" value={witnesses} onChange={setWitnesses} rows={2} placeholder="Names of anyone who saw it" />
          {error && <ErrLine msg={error} />}
          <Actions busy={busy} onBack={() => setType(null)} onSubmit={submitInjury} submitLabel="Submit accident report" />
        </div>
      )}
    </Shell>
  );
}

/* ── pieces ── */

function Shell({ attractionName, context, onCancel, children }: { attractionName: string; context?: string; onCancel: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }} onClick={onCancel}>
      <div style={{ width: '100%', maxWidth: 480, background: surface.card, border: `1px solid ${border.default}`, borderRadius: radius.xl, padding: 24, margin: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <p style={{ color: text.primary, fontSize: 16, fontWeight: 600, margin: 0 }}>Incident report</p>
            <p style={{ color: text.muted, fontSize: 12, margin: '2px 0 0' }}>{attractionName}{context ? ` · ${context}` : ''}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function TypeChoice({ title, body, accent, onClick }: { title: string; body: string; accent: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ textAlign: 'left', background: surface.control, border: `1px solid ${border.default}`, borderLeft: `3px solid ${accent}`, borderRadius: radius.md, padding: '14px 16px', cursor: 'pointer' }}>
      <div style={{ color: text.primary, fontSize: 15, fontWeight: 600 }}>{title}</div>
      <div style={{ color: text.muted, fontSize: 12, marginTop: 3, lineHeight: 1.4 }}>{body}</div>
    </button>
  );
}

function Chips({ label, options, value, onChange, accent }: { label: string; options: string[]; value: string; onChange: (v: string) => void; accent: string }) {
  return (
    <div>
      <p style={{ ...microLabel, marginBottom: 8 }}>{label}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map((c) => (
          <button key={c} type="button" onClick={() => onChange(c)}
            style={{ padding: '8px 12px', borderRadius: radius.md, cursor: 'pointer', fontSize: 13, background: value === c ? `${accent}22` : surface.control, border: `1px solid ${value === c ? accent : border.default}`, color: value === c ? text.primary : text.secondary }}>
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

function SeverityPicker({ value, onChange }: { value: IncidentSeverity; onChange: (v: IncidentSeverity) => void }) {
  return (
    <div>
      <p style={{ ...microLabel, marginBottom: 8 }}>Severity</p>
      <div style={{ display: 'flex', gap: 8 }}>
        {SEVERITIES.map((s) => (
          <button key={s.value} type="button" onClick={() => onChange(s.value)}
            style={{ flex: 1, padding: '10px 0', borderRadius: radius.md, cursor: 'pointer', fontSize: 13, fontWeight: 600, background: value === s.value ? `${s.color}22` : surface.control, border: `1px solid ${value === s.value ? s.color : border.default}`, color: value === s.value ? s.color : text.muted }}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, on, onToggle, hint }: { label: string; on: boolean; onToggle: () => void; hint?: string }) {
  return (
    <button type="button" onClick={onToggle}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: surface.control, border: `1px solid ${on ? '#22C55E' : border.default}`, borderRadius: radius.md, padding: '11px 14px', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
      <span>
        <span style={{ color: text.primary, fontSize: 14 }}>{label}</span>
        {hint && <span style={{ display: 'block', color: text.faint, fontSize: 11, marginTop: 2 }}>{hint}</span>}
      </span>
      <span style={{ width: 38, height: 22, borderRadius: 11, flexShrink: 0, background: on ? '#22C55E' : '#1C1F26', border: on ? 'none' : `1px solid ${border.strong}`, position: 'relative' }}>
        <span style={{ position: 'absolute', top: 2, [on ? 'right' : 'left']: 2, width: 16, height: 16, borderRadius: '50%', background: on ? '#fff' : '#475569' }} />
      </span>
    </button>
  );
}

function Field({ label, value, onChange, rows, placeholder }: { label: string; value: string; onChange: (v: string) => void; rows: number; placeholder: string }) {
  const common = { width: '100%', background: surface.control, border: `1px solid ${border.strong}`, borderRadius: radius.md, color: text.primary, fontSize: 14, padding: '10px 12px', outline: 'none', fontFamily: 'inherit' } as React.CSSProperties;
  return (
    <div>
      <p style={{ ...microLabel, marginBottom: 8 }}>{label}</p>
      {rows <= 1 ? (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={common} />
      ) : (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} style={{ ...common, resize: 'vertical', lineHeight: 1.5 }} />
      )}
    </div>
  );
}

function ErrLine({ msg }: { msg: string }) {
  return <p style={{ color: '#FCA5A5', fontSize: 13, margin: 0 }}>{msg}</p>;
}

function Actions({ busy, onBack, onSubmit, submitLabel = 'Submit report' }: { busy: boolean; onBack: () => void; onSubmit: () => void; submitLabel?: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
      <button type="button" onClick={onBack} style={{ ...controlButton, flex: 1, padding: '12px 0', fontSize: 14, fontWeight: 600 }}>Back</button>
      <button type="button" onClick={onSubmit} disabled={busy} style={{ ...primaryButton('admin'), flex: 2, padding: '12px 0', fontSize: 14, opacity: busy ? 0.6 : 1 }}>
        {busy ? 'Submitting…' : submitLabel}
      </button>
    </div>
  );
}
