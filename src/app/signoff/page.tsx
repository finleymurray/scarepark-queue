'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { checkAuth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import {
  verifyPin,
  SIGNOFF_ROLE_LABELS,
  getTodayDateStr,
} from '@/lib/signoff';
import { getAttractionLogo, getLogoGlow } from '@/lib/logos';
import type {
  Attraction,
  SignoffSection,
  SignoffChecklistItem,
  SignoffCompletion,
  SignoffRoleKey,
} from '@/types/database';

/* ── PIN Pad Modal ── */
function PinPadModal({
  open,
  onVerified,
  onCancel,
  requiredRole,
}: {
  open: boolean;
  onVerified: (userName: string, userEmail: string) => void;
  onCancel: () => void;
  requiredRole: SignoffRoleKey;
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  function handleDigit(d: string) {
    if (pin.length >= 4) return;
    setPin((p) => p + d);
    setError('');
  }

  function handleBackspace() {
    setPin((p) => p.slice(0, -1));
    setError('');
  }

  async function handleSubmit() {
    if (pin.length < 4) {
      setError('PIN must be 4 digits.');
      return;
    }
    setVerifying(true);
    const result = await verifyPin(pin);
    setVerifying(false);

    if (!result.valid) {
      setError(result.error);
      setPin('');
      return;
    }

    if (!result.signoffRoles.includes(requiredRole)) {
      setError(`You don't have the "${SIGNOFF_ROLE_LABELS[requiredRole]}" role.`);
      setPin('');
      return;
    }

    setPin('');
    setError('');
    onVerified(result.userName, result.userEmail);
  }

  function handleClose() {
    setPin('');
    setError('');
    onCancel();
  }

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (pin.length === 4) {
      handleSubmit();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  if (!open) return null;

  const dots = Array.from({ length: 4 }, (_, i) => i < pin.length);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4">
      <div className="w-full max-w-sm rounded-xl bg-[#111] border border-[#333] p-6">
        <p className="text-white text-center text-sm font-semibold mb-1">Enter Your PIN</p>
        <p className="text-white/40 text-center text-xs mb-5">
          Requires: {SIGNOFF_ROLE_LABELS[requiredRole]}
        </p>

        {/* Dots */}
        <div className="flex justify-center gap-4 mb-5">
          {dots.map((filled, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-colors ${
                filled ? 'bg-white border-white' : 'border-[#555] bg-transparent'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-[#d43518] text-xs text-center mb-3">{error}</p>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              onClick={() => handleDigit(d)}
              className="py-4 text-2xl font-bold text-white bg-[#1a1a1a] rounded-lg
                         active:bg-[#222] transition-colors touch-manipulation"
            >
              {d}
            </button>
          ))}
          <button
            onClick={handleBackspace}
            className="py-4 text-lg font-bold text-yellow-400 bg-[#1a1a1a] rounded-lg
                       active:bg-yellow-900/30 transition-colors touch-manipulation"
          >
            DEL
          </button>
          <button
            onClick={() => handleDigit('0')}
            className="py-4 text-2xl font-bold text-white bg-[#1a1a1a] rounded-lg
                       active:bg-[#222] transition-colors touch-manipulation"
          >
            0
          </button>
          <button
            onClick={handleSubmit}
            disabled={pin.length < 4 || verifying}
            className="py-4 text-lg font-bold text-black bg-white rounded-lg
                       active:bg-white/80 transition-colors touch-manipulation disabled:opacity-40"
          >
            {verifying ? '...' : '\u2713'}
          </button>
        </div>

        <button
          onClick={handleClose}
          className="w-full py-3 text-white/40 text-sm font-medium
                     active:bg-[#222] rounded-lg transition-colors touch-manipulation"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function SignoffPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');

  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [selectedAttractionId, setSelectedAttractionId] = useState<string>('');
  const [phase, setPhase] = useState<'opening' | 'closing'>('opening');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Sections + items + completions
  const [sections, setSections] = useState<SignoffSection[]>([]);
  const [items, setItems] = useState<Map<string, SignoffChecklistItem[]>>(new Map());
  const [completions, setCompletions] = useState<Map<string, SignoffCompletion>>(new Map());

  // Active section being signed off
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  // PIN modal
  const [showPinPad, setShowPinPad] = useState(false);
  const [pinSectionId, setPinSectionId] = useState<string | null>(null);

  const fetchData = useCallback(async (attractionId: string) => {
    if (!attractionId) return;

    const today = getTodayDateStr();

    const [sectionsRes, completionsRes] = await Promise.all([
      supabase
        .from('signoff_sections')
        .select('*')
        .eq('attraction_id', attractionId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('signoff_completions')
        .select('*')
        .eq('attraction_id', attractionId)
        .eq('sign_date', today),
    ]);

    const secs: SignoffSection[] = sectionsRes.data || [];
    setSections(secs);

    const compMap = new Map<string, SignoffCompletion>();
    for (const c of (completionsRes.data || [])) {
      compMap.set(c.section_id, c);
    }
    setCompletions(compMap);

    // Fetch checklist items for all sections
    if (secs.length > 0) {
      const secIds = secs.map((s) => s.id);
      const { data: itemsData } = await supabase
        .from('signoff_checklist_items')
        .select('*')
        .in('section_id', secIds)
        .order('sort_order', { ascending: true });

      const itemMap = new Map<string, SignoffChecklistItem[]>();
      for (const item of (itemsData || [])) {
        if (!itemMap.has(item.section_id)) itemMap.set(item.section_id, []);
        itemMap.get(item.section_id)!.push(item);
      }
      setItems(itemMap);
    } else {
      setItems(new Map());
    }
  }, []);

  useEffect(() => {
    async function init() {
      const auth = await checkAuth();
      if (!auth.authenticated) {
        router.push('/login');
        return;
      }
      setUserEmail(auth.email || '');

      const { data: attractionsData } = await supabase
        .from('attractions')
        .select('*')
        .order('sort_order', { ascending: true });

      if (attractionsData && attractionsData.length > 0) {
        setAttractions(attractionsData);
        setSelectedAttractionId(attractionsData[0].id);
      }

      setLoading(false);
    }
    init();
  }, [router]);

  useEffect(() => {
    if (selectedAttractionId) {
      fetchData(selectedAttractionId);
      setActiveSectionId(null);
      setCheckedItems(new Set());
    }
  }, [selectedAttractionId, fetchData]);

  // Realtime subscription for completions
  useEffect(() => {
    if (!selectedAttractionId) return;

    const channel = supabase
      .channel('signoff-completions-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'signoff_completions', filter: `attraction_id=eq.${selectedAttractionId}` },
        () => {
          fetchData(selectedAttractionId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedAttractionId, fetchData]);

  function openSection(sectionId: string) {
    if (completions.has(sectionId)) return;
    setActiveSectionId(sectionId);
    setCheckedItems(new Set());
  }

  function toggleItem(itemId: string) {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function handleSignOffClick(sectionId: string) {
    setPinSectionId(sectionId);
    setShowPinPad(true);
  }

  async function handlePinVerified(userName: string, pinUserEmail: string) {
    if (!pinSectionId || !selectedAttractionId) return;

    const section = sections.find((s) => s.id === pinSectionId);
    if (!section) return;

    const attraction = attractions.find((a) => a.id === selectedAttractionId);
    const today = getTodayDateStr();

    const { error } = await supabase.from('signoff_completions').insert({
      section_id: pinSectionId,
      attraction_id: selectedAttractionId,
      sign_date: today,
      signed_by_name: userName,
      signed_by_email: pinUserEmail,
    });

    if (error) {
      console.error('Sign-off error:', error);
      setShowPinPad(false);
      setPinSectionId(null);
      return;
    }

    await logAudit({
      actionType: 'signoff_completion',
      attractionId: selectedAttractionId,
      attractionName: attraction?.name || 'Unknown',
      performedBy: pinUserEmail,
      newValue: section.name,
      details: `${section.phase} sign-off by ${userName} (${SIGNOFF_ROLE_LABELS[section.role_key as SignoffRoleKey]})`,
    });

    setShowPinPad(false);
    setPinSectionId(null);
    setActiveSectionId(null);
    setCheckedItems(new Set());

    await fetchData(selectedAttractionId);
  }

  const phaseSections = sections.filter((s) => s.phase === phase);
  const totalSections = phaseSections.length;
  const completedSections = phaseSections.filter((s) => completions.has(s.id)).length;
  const selectedAttraction = attractions.find((a) => a.id === selectedAttractionId);

  // Overall status for badge display
  const allOpeningSections = sections.filter((s) => s.phase === 'opening');
  const allClosingSections = sections.filter((s) => s.phase === 'closing');
  const openingDone = allOpeningSections.length > 0 && allOpeningSections.every((s) => completions.has(s.id));
  const closingDone = allClosingSections.length === 0 || allClosingSections.every((s) => completions.has(s.id));
  const fullySignedOff = allOpeningSections.length > 0 && openingDone && closingDone;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="text-white text-2xl font-bold animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-black text-white overflow-hidden">
      {/* PIN Pad */}
      <PinPadModal
        open={showPinPad}
        onVerified={handlePinVerified}
        onCancel={() => { setShowPinPad(false); setPinSectionId(null); }}
        requiredRole={(sections.find((s) => s.id === pinSectionId)?.role_key as SignoffRoleKey) || 'supervisor'}
      />

      {/* Header */}
      <div style={{ background: '#111', borderBottom: '1px solid #333', padding: '12px 20px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/signoff" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <Image src="/logo.png" alt="Immersive Core" width={32} height={32} priority style={{ width: 32, height: 'auto' }} />
          <h1 style={{ color: '#fff', fontSize: 18, fontWeight: 600, margin: 0 }}>Sign-Off</h1>
        </a>
        <span className="text-white/40 text-xs">{userEmail}</span>
      </div>

      {/* Attraction selector — dropdown trigger */}
      <div style={{ background: '#111', borderBottom: '1px solid #333', padding: '8px 20px', flexShrink: 0, position: 'relative' }}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-[#1a1a1a] border border-[#333] rounded-xl
                     active:bg-[#222] transition-colors touch-manipulation"
        >
          <div className="flex items-center gap-3">
            {selectedAttraction && (() => {
              const logo = getAttractionLogo(selectedAttraction.slug);
              const glow = getLogoGlow(selectedAttraction.slug);
              return logo ? (
                <img src={logo} alt="" width={24} height={24} loading="lazy" decoding="async"
                     className="rounded object-contain" style={{ width: 24, height: 24, filter: glow || undefined }} />
              ) : null;
            })()}
            <span className="text-white text-sm font-semibold">
              {selectedAttraction?.name || 'Select attraction'}
            </span>
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}>
            <path d="M4 6L8 10L12 6" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Dropdown */}
        {dropdownOpen && (
          <>
            {/* Backdrop to close dropdown */}
            <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
            <div className="absolute left-5 right-5 top-full mt-1 z-50 bg-[#111] border border-[#333] rounded-xl overflow-hidden shadow-2xl"
                 style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {attractions.map((a) => {
                const active = a.id === selectedAttractionId;
                const logo = getAttractionLogo(a.slug);
                const glow = getLogoGlow(a.slug);
                return (
                  <button
                    key={a.id}
                    onClick={() => { setSelectedAttractionId(a.id); setDropdownOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors touch-manipulation
                      ${active ? 'bg-[#222] text-white' : 'text-white/60 active:bg-[#1a1a1a]'}`}
                    style={{ borderBottom: '1px solid #222' }}
                  >
                    {logo ? (
                      <img src={logo} alt="" width={28} height={28} loading="lazy" decoding="async"
                           className="rounded object-contain" style={{ width: 28, height: 28, filter: glow || undefined }} />
                    ) : (
                      <div className="w-7 h-7 rounded bg-[#222]" />
                    )}
                    <span className="text-sm font-medium">{a.name}</span>
                    {active && (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="ml-auto shrink-0">
                        <path d="M3 7L6 10L11 4" stroke="#4caf50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Main Content — Scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px' }}>
        {selectedAttraction && (
          <>
            {/* ── Attraction Logo (centered, large — matches field control) ── */}
            {(() => {
              const logo = getAttractionLogo(selectedAttraction.slug);
              const glow = getLogoGlow(selectedAttraction.slug);
              return logo ? (
                <div className="flex justify-center mb-6">
                  <img src={logo} alt={selectedAttraction.name} loading="lazy" decoding="async"
                       className="object-contain w-[100px] sm:w-[160px]"
                       style={{ height: 'auto', maxHeight: 100, filter: glow || undefined }} />
                </div>
              ) : null;
            })()}

            {/* ── Sign-Off Status Badge ── */}
            <div className="mb-8 flex flex-col items-center gap-1">
              {fullySignedOff ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#0a3d1f] text-[#4caf50]">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#4caf50" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  SIGNED OFF
                </span>
              ) : allOpeningSections.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#3d1010] text-[#d43518]">
                  NOT SIGNED OFF
                </span>
              ) : null}
              <p className="text-white/30 text-xs">
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            {/* ── Phase Toggle ── */}
            <section style={{ marginBottom: 48 }}>
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-2 h-2 rounded-full bg-white" />
                <h2 className="text-white/60 text-sm uppercase tracking-wider font-semibold">Sign-Off Sections</h2>
              </div>

              {/* Phase tabs */}
              <div className="flex gap-3 mb-5">
                {(['opening', 'closing'] as const).map((p) => {
                  const active = phase === p;
                  const pSections = sections.filter((s) => s.phase === p);
                  const pCompleted = pSections.filter((s) => completions.has(s.id)).length;
                  const allDone = pSections.length > 0 && pCompleted === pSections.length;
                  const closingLocked = p === 'closing' && !openingDone;
                  return (
                    <button
                      key={p}
                      onClick={() => {
                        if (closingLocked) return;
                        setPhase(p); setActiveSectionId(null); setCheckedItems(new Set());
                      }}
                      disabled={closingLocked}
                      className={`flex-1 py-4 rounded-xl text-sm font-semibold capitalize transition-colors border touch-manipulation
                        ${closingLocked
                          ? 'bg-[#111] border-[#222] text-white/20 cursor-not-allowed'
                          : active
                            ? allDone
                              ? 'bg-[#0a3d1f] border-[#1a4a1a] text-[#4caf50]'
                              : 'bg-[#222] border-[#555] text-white'
                            : 'bg-[#1a1a1a] border-[#333] text-white/40 active:bg-[#222]'
                        }`}
                    >
                      {closingLocked && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="inline-block mr-1.5 -mt-0.5">
                          <rect x="2" y="5.5" width="8" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                          <path d="M4 5.5V3.5C4 2.4 4.9 1.5 6 1.5C7.1 1.5 8 2.4 8 3.5V5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
                        </svg>
                      )}
                      {p}
                      {pSections.length > 0 && !closingLocked && (
                        <span className="ml-2 text-xs opacity-70">
                          {allDone ? '\u2713' : `${pCompleted}/${pSections.length}`}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Progress bar */}
              {totalSections > 0 && (
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-white/40 text-xs">
                      {completedSections}/{totalSections} sections signed off
                    </span>
                    {completedSections === totalSections && (
                      <span className="text-[#4caf50] text-xs font-semibold">COMPLETE</span>
                    )}
                  </div>
                  <div className="w-full h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(completedSections / totalSections) * 100}%`,
                        background: completedSections === totalSections ? '#4caf50' : '#6ea8fe',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* No sections message */}
              {totalSections === 0 && (
                <div className="bg-[#111] border border-[#333] rounded-xl p-10 text-center">
                  <p className="text-white/30 text-sm">No {phase} sections configured for {selectedAttraction?.name || 'this attraction'}.</p>
                  <p className="text-white/20 text-xs mt-2">Ask an admin to configure sign-off sections.</p>
                </div>
              )}

              {/* Section cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {phaseSections.map((section) => {
                  const completion = completions.get(section.id);
                  const isCompleted = !!completion;
                  const isActive = activeSectionId === section.id;
                  const sectionItems = items.get(section.id) || [];
                  const allChecked = sectionItems.length > 0 && sectionItems.every((i) => checkedItems.has(i.id));

                  return (
                    <div
                      key={section.id}
                      className={`bg-[#111] border rounded-xl overflow-hidden transition-colors
                        ${isCompleted ? 'border-[#1a4a1a]' : isActive ? 'border-[#555]' : 'border-[#333]'}`}
                    >
                      {/* Section header — clickable if not completed */}
                      <button
                        onClick={() => !isCompleted && openSection(section.id)}
                        disabled={isCompleted}
                        className="w-full text-left px-5 py-4 flex items-center justify-between touch-manipulation"
                        style={{ background: 'transparent', border: 'none', cursor: isCompleted ? 'default' : 'pointer' }}
                      >
                        <div className="flex items-center gap-3">
                          {isCompleted ? (
                            <div className="w-8 h-8 rounded-full bg-[#1a4a1a] flex items-center justify-center shrink-0">
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path d="M3 7L6 10L11 4" stroke="#4caf50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full border-2 border-[#444] shrink-0" />
                          )}

                          <div>
                            <span className={`text-sm font-semibold ${isCompleted ? 'text-[#4caf50]' : 'text-white'}`}>
                              {section.name}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] px-1.5 py-0.5 bg-[#1a2a3a] text-[#6ea8fe] rounded font-medium">
                                {SIGNOFF_ROLE_LABELS[section.role_key as SignoffRoleKey] || section.role_key}
                              </span>
                              {isCompleted && completion && (
                                <span className="text-white/30 text-[11px]">
                                  {completion.signed_by_name} &middot; {new Date(completion.signed_at).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {!isCompleted && (
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={`transition-transform shrink-0 ${isActive ? 'rotate-180' : ''}`}>
                            <path d="M4 6L8 10L12 6" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>

                      {/* Expanded checklist */}
                      {isActive && !isCompleted && (
                        <div className="px-5 pb-5 border-t border-[#222]">
                          {sectionItems.length === 0 ? (
                            <p className="text-white/30 text-sm py-4">No checklist items for this section.</p>
                          ) : (
                            <div className="py-2">
                              {sectionItems.map((item) => {
                                const checked = checkedItems.has(item.id);
                                return (
                                  <label
                                    key={item.id}
                                    className={`flex items-center gap-3 py-3.5 border-b border-[#222] last:border-0 cursor-pointer transition-colors touch-manipulation
                                      ${checked ? 'opacity-100' : 'opacity-70'}`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleItem(item.id)}
                                      className="accent-[#4caf50] w-5 h-5 shrink-0"
                                    />
                                    <span className={`text-sm ${checked ? 'text-white/50 line-through' : 'text-white'}`}>
                                      {item.label}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          )}

                          {/* Sign off button */}
                          <button
                            onClick={() => handleSignOffClick(section.id)}
                            disabled={!allChecked && sectionItems.length > 0}
                            className="w-full mt-3 py-4 text-sm font-bold rounded-xl transition-colors touch-manipulation
                                       flex items-center justify-center gap-2
                                       disabled:opacity-30 disabled:cursor-not-allowed"
                            style={{
                              background: allChecked || sectionItems.length === 0 ? '#fff' : '#333',
                              color: allChecked || sectionItems.length === 0 ? '#000' : '#666',
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <path d="M3.5 8L6.5 11L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Sign Off with PIN
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        <div style={{ textAlign: 'center', paddingBottom: 24 }}>
          <Link href="/privacy" style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, textDecoration: 'none' }}>
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
