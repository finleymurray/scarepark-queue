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
      <div className="w-full max-w-sm rounded-lg bg-[#161616] border border-[#2a2a2a] p-6">
        <p className="text-[#e0e0e0] text-center text-sm font-semibold mb-1">Enter Your PIN</p>
        <p className="text-[#777] text-center text-xs mb-5">
          Requires: {SIGNOFF_ROLE_LABELS[requiredRole]}
        </p>

        {/* Dots */}
        <div className="flex justify-center gap-4 mb-5">
          {dots.map((filled, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-colors ${
                filled ? 'bg-[#4caf50] border-[#4caf50]' : 'border-[#3a3a3a] bg-transparent'
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
              className="py-4 text-2xl font-bold text-[#e0e0e0] bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg
                         active:bg-[#252525] transition-colors touch-manipulation"
            >
              {d}
            </button>
          ))}
          <button
            onClick={handleBackspace}
            className="py-4 text-lg font-bold text-[#f0ad4e] bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg
                       active:bg-[#252525] transition-colors touch-manipulation"
          >
            DEL
          </button>
          <button
            onClick={() => handleDigit('0')}
            className="py-4 text-2xl font-bold text-[#e0e0e0] bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg
                       active:bg-[#252525] transition-colors touch-manipulation"
          >
            0
          </button>
          <button
            onClick={handleSubmit}
            disabled={pin.length < 4 || verifying}
            className="py-4 text-lg font-bold text-[#0d0d0d] bg-[#4caf50] rounded-lg
                       active:bg-[#43a047] transition-colors touch-manipulation disabled:opacity-40"
          >
            {verifying ? '...' : '\u2713'}
          </button>
        </div>

        <button
          onClick={handleClose}
          className="w-full py-3 text-[#777] text-sm font-medium border border-[#2a2a2a] rounded-lg
                     active:bg-[#1c1c1c] transition-colors touch-manipulation"
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
      <div className="flex h-screen items-center justify-center bg-[#0d0d0d]">
        <div className="text-[#777] text-sm animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-[#0d0d0d] text-[#e0e0e0] overflow-hidden">
      {/* PIN Pad */}
      <PinPadModal
        open={showPinPad}
        onVerified={handlePinVerified}
        onCancel={() => { setShowPinPad(false); setPinSectionId(null); }}
        requiredRole={(sections.find((s) => s.id === pinSectionId)?.role_key as SignoffRoleKey) || 'supervisor'}
      />

      {/* Header */}
      <div className="bg-[#141414] border-b border-[#2a2a2a] px-5 py-3 flex items-center justify-between shrink-0">
        <a href="/signoff" className="flex items-center gap-3 no-underline">
          <Image src="/logo.png" alt="Immersive Core" width={32} height={32} priority style={{ width: 32, height: 'auto' }} />
          <h1 className="text-[#e0e0e0] text-lg font-semibold m-0">Sign-Off</h1>
        </a>
        <span className="text-[#555] text-xs">{userEmail}</span>
      </div>

      {/* Attraction selector — dropdown trigger */}
      <div className="bg-[#141414] border-b border-[#2a2a2a] px-5 py-2 shrink-0 relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg
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
            <span className="text-[#e0e0e0] text-sm font-semibold">
              {selectedAttraction?.name || 'Select attraction'}
            </span>
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}>
            <path d="M4 6L8 10L12 6" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Dropdown */}
        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
            <div className="absolute left-5 right-5 top-full mt-1 z-50 bg-[#161616] border border-[#2a2a2a] rounded-lg overflow-hidden shadow-2xl"
                 style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {attractions.map((a) => {
                const active = a.id === selectedAttractionId;
                const logo = getAttractionLogo(a.slug);
                const glow = getLogoGlow(a.slug);
                return (
                  <button
                    key={a.id}
                    onClick={() => { setSelectedAttractionId(a.id); setDropdownOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors touch-manipulation border-b border-[#1e1e1e] last:border-0
                      ${active ? 'bg-[#1c1c1c] text-[#e0e0e0]' : 'text-[#777] active:bg-[#1c1c1c]'}`}
                  >
                    {logo ? (
                      <img src={logo} alt="" width={28} height={28} loading="lazy" decoding="async"
                           className="rounded object-contain" style={{ width: 28, height: 28, filter: glow || undefined }} />
                    ) : (
                      <div className="w-7 h-7 rounded bg-[#1c1c1c]" />
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
      <div className="flex-1 overflow-y-auto px-5 py-8">
        {selectedAttraction && (
          <>
            {/* ── Attraction Logo (centered, large) ── */}
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
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#1a3a1a] text-[#4caf50]">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#4caf50" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  SIGNED OFF
                </span>
              ) : allOpeningSections.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#3d1010] text-[#d43518]">
                  NOT SIGNED OFF
                </span>
              ) : null}
              <p className="text-[#555] text-xs">
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            {/* ── Section 1: Sign-Off Sections ── */}
            <section className="mb-12">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-7 h-7 rounded-full bg-[#1a3a1a] flex items-center justify-center text-[#4caf50] text-xs font-bold shrink-0">1</div>
                <h2 className="text-[#e0e0e0] text-base font-bold">Sign-Off Sections</h2>
              </div>

              {/* Phase tabs — text-link style */}
              <div className="flex gap-6 mb-5 border-b border-[#2a2a2a] pb-3">
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
                      className={`text-sm font-semibold capitalize transition-colors pb-1 touch-manipulation
                        ${closingLocked
                          ? 'text-[#333] cursor-not-allowed'
                          : active
                            ? allDone
                              ? 'text-[#4caf50] border-b-2 border-[#4caf50] -mb-[13px] pb-[11px]'
                              : 'text-[#e0e0e0] border-b-2 border-[#e0e0e0] -mb-[13px] pb-[11px]'
                            : 'text-[#777] hover:text-[#ccc]'
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
                        <span className="ml-2 text-xs opacity-60">
                          {allDone ? '\u2713' : `${pCompleted}/${pSections.length}`}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Progress bar */}
              {totalSections > 0 && (
                <div className="bg-[#161616] border border-[#2a2a2a] rounded-lg px-5 py-4 mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[#777] text-xs">
                      {completedSections}/{totalSections} sections signed off
                    </span>
                    {completedSections === totalSections && (
                      <span className="text-[#4caf50] text-xs font-semibold">COMPLETE</span>
                    )}
                  </div>
                  <div className="w-full h-2 bg-[#1c1c1c] rounded-full overflow-hidden">
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
                <div className="bg-[#161616] border border-[#2a2a2a] rounded-lg p-10 text-center">
                  <p className="text-[#555] text-sm">No {phase} sections configured for {selectedAttraction?.name || 'this attraction'}.</p>
                  <p className="text-[#444] text-xs mt-2">Ask an admin to configure sign-off sections.</p>
                </div>
              )}

              {/* Section cards */}
              <div className="flex flex-col gap-3">
                {phaseSections.map((section, idx) => {
                  const completion = completions.get(section.id);
                  const isCompleted = !!completion;
                  const isActive = activeSectionId === section.id;
                  const sectionItems = items.get(section.id) || [];
                  const allChecked = sectionItems.length > 0 && sectionItems.every((i) => checkedItems.has(i.id));

                  return (
                    <div
                      key={section.id}
                      className={`bg-[#161616] border rounded-lg overflow-hidden transition-colors
                        ${isCompleted ? 'border-[#1a3a1a]' : isActive ? 'border-[#3a3a3a]' : 'border-[#2a2a2a]'}`}
                    >
                      {/* Section header — clickable if not completed */}
                      <button
                        onClick={() => !isCompleted && openSection(section.id)}
                        disabled={isCompleted}
                        className="w-full text-left px-5 py-4 flex items-center justify-between touch-manipulation bg-transparent border-none"
                        style={{ cursor: isCompleted ? 'default' : 'pointer' }}
                      >
                        <div className="flex items-center gap-3">
                          {isCompleted ? (
                            <div className="w-8 h-8 rounded-full bg-[#1a3a1a] flex items-center justify-center shrink-0">
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path d="M3 7L6 10L11 4" stroke="#4caf50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#1a3a1a] flex items-center justify-center shrink-0 text-[#4caf50] text-xs font-bold">
                              {idx + 1}
                            </div>
                          )}

                          <div>
                            <span className={`text-sm font-semibold ${isCompleted ? 'text-[#4caf50]' : 'text-[#e0e0e0]'}`}>
                              {section.name}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] px-1.5 py-0.5 bg-[#1c1c1c] text-[#777] rounded font-medium">
                                {SIGNOFF_ROLE_LABELS[section.role_key as SignoffRoleKey] || section.role_key}
                              </span>
                              {isCompleted && completion && (
                                <span className="text-[#555] text-[11px]">
                                  {completion.signed_by_name} &middot; {new Date(completion.signed_at).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {!isCompleted && (
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={`transition-transform shrink-0 ${isActive ? 'rotate-180' : ''}`}>
                            <path d="M4 6L8 10L12 6" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>

                      {/* Expanded checklist */}
                      {isActive && !isCompleted && (
                        <div className="px-5 pb-5 border-t border-[#2a2a2a]">
                          {sectionItems.length === 0 ? (
                            <p className="text-[#555] text-sm py-4">No checklist items for this section.</p>
                          ) : (
                            <div className="py-3 flex flex-col gap-2">
                              {sectionItems.map((item) => {
                                const checked = checkedItems.has(item.id);
                                return (
                                  <label
                                    key={item.id}
                                    className={`flex items-center gap-3 px-4 py-3.5 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg cursor-pointer
                                      transition-colors touch-manipulation ${checked ? 'border-[#1a3a1a]' : ''}`}
                                  >
                                    <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors
                                      ${checked ? 'bg-[#4caf50]' : 'border-2 border-[#3a3a3a]'}`}>
                                      {checked && (
                                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                      )}
                                    </div>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleItem(item.id)}
                                      className="hidden"
                                    />
                                    <span className={`text-sm ${checked ? 'text-[#555] line-through' : 'text-[#e0e0e0]'}`}>
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
                            className="w-full mt-2 py-4 text-sm font-bold rounded-lg transition-colors touch-manipulation
                                       flex items-center justify-center gap-2
                                       disabled:opacity-30 disabled:cursor-not-allowed"
                            style={{
                              background: allChecked || sectionItems.length === 0 ? '#4caf50' : '#2a2a2a',
                              color: allChecked || sectionItems.length === 0 ? '#fff' : '#555',
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

        <div className="text-center pb-6">
          <Link href="/privacy" className="text-[#333] text-[11px] no-underline hover:text-[#555]">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
