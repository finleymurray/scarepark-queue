'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { surface, border, text, accents, radius, microLabel, primaryButton } from '@/lib/theme';
import IncidentForm, { type IncidentFormValues } from '@/components/IncidentForm';

type Step = 'details' | 'form' | 'success';

interface AttractionOption {
  id: string;
  name: string;
  slug: string;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 12px',
  background: surface.control,
  border: `1px solid ${border.strong}`,
  borderRadius: radius.sm,
  color: text.primary,
  fontSize: 14,
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  ...microLabel,
  display: 'block',
  marginBottom: 6,
};

/** Today's date in local time as YYYY-MM-DD. */
function todayLocal(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function IncidentReportFormPage() {
  const [step, setStep] = useState<Step>('details');
  const [name, setName] = useState('');
  const [attractionId, setAttractionId] = useState(''); // '' = General
  const [attractions, setAttractions] = useState<AttractionOption[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase
        .from('attractions')
        .select('id,name,slug')
        .order('sort_order', { ascending: true });
      if (active && data) setAttractions(data as AttractionOption[]);
    }
    load();
    return () => { active = false; };
  }, []);

  const chosen = attractions.find((a) => a.id === attractionId);
  const chosenName = chosen?.name ?? '';
  const chosenId = chosen?.id ?? '';

  async function handleSubmit(values: IncidentFormValues) {
    const { error } = await supabase.from('incidents').insert({
      attraction_id: chosenId || null,
      attraction_name: chosenName || 'General',
      log_date: todayLocal(),
      source: 'staff',
      status: 'submitted',
      incident_type: values.incident_type,
      category: values.category,
      severity: values.severity,
      description: values.description,
      people_involved: values.people_involved,
      actions_taken: values.actions_taken,
      form_data: values.form_data,
      reported_by: name.trim(),
    });
    // Throw on failure so IncidentForm surfaces its own error state.
    if (error) throw error;
    setStep('success');
  }

  function reset() {
    setName('');
    setAttractionId('');
    setStep('details');
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: surface.page,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '48px 20px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 480 }}>
        {step === 'details' && (
          <DetailsStep
            name={name}
            setName={setName}
            attractionId={attractionId}
            setAttractionId={setAttractionId}
            attractions={attractions}
            onContinue={() => setStep('form')}
          />
        )}

        {step === 'success' && <SuccessStep onAnother={reset} />}
      </div>

      {step === 'form' && (
        <IncidentForm
          attractionName={chosenName || 'General'}
          onSubmit={handleSubmit}
          onCancel={() => setStep('details')}
        />
      )}
    </div>
  );
}

function DetailsStep({
  name,
  setName,
  attractionId,
  setAttractionId,
  attractions,
  onContinue,
}: {
  name: string;
  setName: (v: string) => void;
  attractionId: string;
  setAttractionId: (v: string) => void;
  attractions: AttractionOption[];
  onContinue: () => void;
}) {
  const canContinue = name.trim().length > 0;
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
        <Image
          src="/logo.png"
          alt="CoreLink"
          width={48}
          height={48}
          priority
          style={{ width: 48, height: 'auto', marginBottom: 16 }}
        />
        <h1 style={{ color: text.primary, fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', textAlign: 'center' }}>
          Report an incident
        </h1>
        <p style={{ color: text.faint, fontSize: 13, marginTop: 6, textAlign: 'center' }}>
          For park staff — no login needed.
        </p>
      </div>

      <div
        style={{
          background: surface.card,
          border: `1px solid ${border.default}`,
          borderRadius: radius.xl,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <div>
          <label htmlFor="ir-name" style={labelStyle}>Your name</label>
          <input
            id="ir-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="First and last name"
            style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = accents.admin.base; e.target.style.boxShadow = `0 0 0 3px ${accents.admin.soft}`; }}
            onBlur={(e) => { e.target.style.borderColor = border.strong; e.target.style.boxShadow = 'none'; }}
          />
        </div>

        <div>
          <label htmlFor="ir-attraction" style={labelStyle}>Attraction</label>
          <select
            id="ir-attraction"
            value={attractionId}
            onChange={(e) => setAttractionId(e.target.value)}
            style={{ ...inputStyle, appearance: 'auto', cursor: 'pointer' }}
          >
            <option value="">General / not attraction-specific</option>
            {attractions.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          style={{
            ...primaryButton('admin'),
            width: '100%',
            minHeight: 52,
            padding: '12px 16px',
            fontSize: 14,
            cursor: canContinue ? 'pointer' : 'not-allowed',
            opacity: canContinue ? 1 : 0.5,
          }}
        >
          Continue
        </button>
      </div>
    </>
  );
}

function SuccessStep({ onAnother }: { onAnother: () => void }) {
  return (
    <div
      style={{
        background: surface.card,
        border: `1px solid ${border.default}`,
        borderRadius: radius.xl,
        padding: '40px 28px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        marginTop: 24,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'rgba(34,197,94,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <h1 style={{ color: text.primary, fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
        Report submitted
      </h1>
      <p style={{ color: text.secondary, fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>
        Thank you — a manager will review it.
      </p>
      <button
        type="button"
        onClick={onAnother}
        style={{
          ...primaryButton('admin'),
          width: '100%',
          minHeight: 52,
          padding: '12px 16px',
          fontSize: 14,
          marginTop: 28,
        }}
      >
        Submit another report
      </button>
    </div>
  );
}
