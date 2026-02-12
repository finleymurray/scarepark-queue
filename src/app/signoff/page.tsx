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
import { getAttractionLogo, getLogoGlow, getGlowRgb } from '@/lib/logos';
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
      <div className="w-full max-w-sm bg-[#111] border border-[#333] rounded-[12px] p-8">
        <p className="text-white text-center text-base font-semibold mb-1">Enter Your PIN</p>
        <p className="text-[#888] text-center text-[13px] mb-6">
          Requires: {SIGNOFF_ROLE_LABELS[requiredRole]}
        </p>

        {/* Dots */}
        <div className="flex justify-center gap-4 mb-6">
          {dots.map((filled, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-colors ${
                filled ? 'bg-[#6ea8fe] border-[#6ea8fe]' : 'border-[#444] bg-transparent'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="bg-[#2a1010] border border-[#d43518] rounded-[6px] px-3 py-2 mb-4">
            <p className="text-[#f0a0a0] text-[13px] text-center">{error}</p>
          </div>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              onClick={() => handleDigit(d)}
              className="py-4 text-2xl font-bold text-[#e0e0e0] bg-[#1a1a1a] border border-[#333] rounded-[6px]
                         active:bg-[#222] transition-colors touch-manipulation"
            >
              {d}
            </button>
          ))}
          <button
            onClick={handleBackspace}
            className="py-4 text-lg font-bold text-[#ffc107] bg-[#1a1a1a] border border-[#333] rounded-[6px]
                       active:bg-[#222] transition-colors touch-manipulation"
          >
            DEL
          </button>
          <button
            onClick={() => handleDigit('0')}
            className="py-4 text-2xl font-bold text-[#e0e0e0] bg-[#1a1a1a] border border-[#333] rounded-[6px]
                       active:bg-[#222] transition-colors touch-manipulation"
          >
            0
          </button>
          <button
            onClick={handleSubmit}
            disabled={pin.length < 4 || verifying}
            className="py-4 text-lg font-bold text-black bg-white rounded-[6px]
                       active:bg-[#ddd] transition-colors touch-manipulation disabled:opacity-50"
          >
            {verifying ? '...' : '\u2713'}
          </button>
        </div>

        <button
          onClick={handleClose}
          className="w-full py-3 text-[#ccc] text-sm font-medium border border-[#555] rounded-[6px]
                     hover:border-[#888] hover:text-white transition-colors touch-manipulation"
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
        // Do NOT auto-select — show attraction grid first
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

  function selectAttraction(id: string) {
    setSelectedAttractionId(id);
    setPhase('opening');
    setActiveSectionId(null);
    setCheckedItems(new Set());
  }

  function goBackToGrid() {
    setSelectedAttractionId('');
    setSections([]);
    setItems(new Map());
    setCompletions(new Map());
    setActiveSectionId(null);
    setCheckedItems(new Set());
  }

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

  const selectedAttraction = attractions.find((a) => a.id === selectedAttractionId);
  const phaseSections = sections.filter((s) => s.phase === phase);
  const totalSections = phaseSections.length;
  const completedSections = phaseSections.filter((s) => completions.has(s.id)).length;

  // Overall status for badge display
  const allOpeningSections = sections.filter((s) => s.phase === 'opening');
  const allClosingSections = sections.filter((s) => s.phase === 'closing');
  const openingDone = allOpeningSections.length > 0 && allOpeningSections.every((s) => completions.has(s.id));
  const closingDone = allClosingSections.length === 0 || allClosingSections.every((s) => completions.has(s.id));
  const fullySignedOff = allOpeningSections.length > 0 && openingDone && closingDone;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="text-[#888] text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-black text-[#e0e0e0] overflow-hidden" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* PIN Pad */}
      <PinPadModal
        open={showPinPad}
        onVerified={handlePinVerified}
        onCancel={() => { setShowPinPad(false); setPinSectionId(null); }}
        requiredRole={(sections.find((s) => s.id === pinSectionId)?.role_key as SignoffRoleKey) || 'supervisor'}
      />

      {/* Header */}
      <div className="bg-[#111] border-b border-[#333] px-6 py-4 flex items-center justify-between shrink-0">
        <a href="/signoff" className="flex items-center gap-3 no-underline">
          <Image src="/logo.png" alt="Immersive Core" width={36} height={36} priority style={{ width: 36, height: 'auto' }} />
          <h1 className="text-white text-lg font-semibold m-0">Sign-Off</h1>
        </a>
        <span className="text-[#aaa] text-[13px]">{userEmail}</span>
      </div>

      {/* Main Content — Scrollable */}
      <div className="flex-1 overflow-y-auto">
        {/* ────────────────────────────────────────────── */}
        {/* Attraction Grid (no attraction selected)      */}
        {/* ────────────────────────────────────────────── */}
        {!selectedAttractionId && (
          <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%', padding: '32px 24px' }}>
            <p className="text-[#888] text-sm text-center mb-8">Select an attraction to begin sign-off</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
              {attractions.map((a) => {
                const logo = getAttractionLogo(a.slug);
                const glow = getLogoGlow(a.slug);
                const glowRgb = getGlowRgb(a.slug);

                return (
                  <button
                    key={a.id}
                    onClick={() => selectAttraction(a.id)}
                    className="relative overflow-hidden rounded-[12px] border border-[#333] bg-[#111]
                               transition-all duration-200 touch-manipulation
                               hover:border-[#555] active:scale-[0.97]
                               focus:outline-none focus:border-[#6ea8fe] focus:shadow-[0_0_0_2px_rgba(110,168,254,0.2)]"
                    style={{ aspectRatio: '1' }}
                  >
                    {/* Subtle glow radial gradient */}
                    {glowRgb && (
                      <div
                        className="absolute inset-0"
                        style={{
                          background: `radial-gradient(circle at center, rgba(${glowRgb}, 0.12) 0%, transparent 70%)`,
                        }}
                      />
                    )}

                    {/* Logo */}
                    <div className="relative z-10 flex items-center justify-center h-full p-3">
                      {logo ? (
                        <img
                          src={logo}
                          alt={a.name}
                          loading="lazy"
                          decoding="async"
                          className="object-contain w-full h-full"
                          style={{ filter: glow || undefined }}
                        />
                      ) : (
                        <span className="text-[#888] text-3xl font-bold">{a.name.charAt(0)}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="text-center pt-10 pb-8">
              <Link href="/privacy" className="text-[#555] text-[11px] no-underline hover:text-[#888]">
                Privacy Policy
              </Link>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────── */}
        {/* Sign-Off View (attraction selected)           */}
        {/* ────────────────────────────────────────────── */}
        {selectedAttraction && (
          <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%', padding: '40px 28px' }}>
            {/* Back button */}
            <button
              onClick={goBackToGrid}
              className="flex items-center gap-2 text-[#aaa] text-sm font-medium mb-8
                         hover:text-white transition-colors touch-manipulation"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              All Attractions
            </button>

            {/* ── Attraction Logo (centered, large) ── */}
            {(() => {
              const logo = getAttractionLogo(selectedAttraction.slug);
              const glow = getLogoGlow(selectedAttraction.slug);
              return logo ? (
                <div className="flex justify-center mb-10">
                  <img src={logo} alt={selectedAttraction.name} loading="lazy" decoding="async"
                       className="object-contain w-[120px] sm:w-[180px]"
                       style={{ height: 'auto', maxHeight: 120, filter: glow || undefined }} />
                </div>
              ) : null;
            })()}

            {/* ── Sign-Off Status Badge ── */}
            <div className="mb-12 flex flex-col items-center gap-3">
              {fullySignedOff ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-[12px] bg-[#0a3d1f] text-[#4caf50]">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#4caf50" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  SIGNED OFF
                </span>
              ) : allOpeningSections.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-[12px] bg-[#3d1010] text-[#ef4444]">
                  NOT SIGNED OFF
                </span>
              ) : null}
              <p className="text-[#888] text-[13px]">
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            {/* ── Sign-Off Sections ── */}
            <fieldset className="border border-[#333] rounded-[16px] p-6 sm:p-10 mb-10 bg-[#111]">
              <legend className="text-base font-semibold text-white px-4 flex items-center gap-4">
                <span className="inline-flex items-center justify-center w-9 h-9 bg-white text-black rounded-full text-sm font-bold">1</span>
                Sign-Off Sections
              </legend>

              {/* Phase tabs */}
              <div className="flex gap-4 mb-8">
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
                      className={`px-5 py-2.5 rounded-[8px] text-sm font-medium capitalize transition-colors touch-manipulation
                        ${closingLocked
                          ? 'text-[#555] bg-transparent cursor-not-allowed'
                          : active
                            ? 'bg-[#222] text-white'
                            : 'text-[#aaa] hover:bg-[#222] hover:text-white'
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
                <div className="bg-[#1a1a1a] border border-[#333] rounded-[10px] px-6 py-5 mb-8">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[#888] text-[13px]">
                      {completedSections}/{totalSections} sections signed off
                    </span>
                    {completedSections === totalSections && (
                      <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded-[12px] bg-[#0a3d1f] text-[#4caf50]">COMPLETE</span>
                    )}
                  </div>
                  <div className="w-full h-2 bg-[#222] rounded-full overflow-hidden">
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
                <div className="text-center py-8">
                  <p className="text-[#666] text-sm">No {phase} sections configured for {selectedAttraction?.name || 'this attraction'}.</p>
                  <p className="text-[#555] text-[13px] mt-2">Ask an admin to configure sign-off sections.</p>
                </div>
              )}

              {/* Section cards */}
              <div className="flex flex-col gap-5">
                {phaseSections.map((section, idx) => {
                  const completion = completions.get(section.id);
                  const isCompleted = !!completion;
                  const isActive = activeSectionId === section.id;
                  const sectionItems = items.get(section.id) || [];
                  const allChecked = sectionItems.length > 0 && sectionItems.every((i) => checkedItems.has(i.id));

                  return (
                    <div
                      key={section.id}
                      className={`bg-[#1a1a1a] border rounded-[12px] overflow-hidden transition-colors
                        ${isCompleted ? 'border-[#4caf50]/30' : isActive ? 'border-[#555]' : 'border-[#333]'}`}
                    >
                      {/* Section header — clickable if not completed */}
                      <button
                        onClick={() => !isCompleted && openSection(section.id)}
                        disabled={isCompleted}
                        className="w-full text-left px-6 py-5 flex items-center justify-between touch-manipulation bg-transparent border-none"
                        style={{ cursor: isCompleted ? 'default' : 'pointer' }}
                      >
                        <div className="flex items-center gap-4">
                          {isCompleted ? (
                            <div className="w-10 h-10 rounded-full bg-[#0a3d1f] flex items-center justify-center shrink-0">
                              <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                                <path d="M3 7L6 10L11 4" stroke="#4caf50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                          ) : (
                            <span className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shrink-0 text-sm font-bold">
                              {idx + 1}
                            </span>
                          )}

                          <div>
                            <span className={`text-sm font-medium ${isCompleted ? 'text-[#4caf50]' : 'text-[#e0e0e0]'}`}>
                              {section.name}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-[#888] font-medium">
                                {SIGNOFF_ROLE_LABELS[section.role_key as SignoffRoleKey] || section.role_key}
                              </span>
                              {isCompleted && completion && (
                                <span className="text-[#888] text-[11px]">
                                  &middot; {completion.signed_by_name} &middot; {new Date(completion.signed_at).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })}
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
                        <div className="px-6 pb-6 border-t border-[#333]">
                          {sectionItems.length === 0 ? (
                            <p className="text-[#666] text-sm py-6">No checklist items for this section.</p>
                          ) : (
                            <div className="py-5 flex flex-col gap-4">
                              {sectionItems.map((item) => {
                                const checked = checkedItems.has(item.id);
                                return (
                                  <label
                                    key={item.id}
                                    className={`flex items-center gap-5 px-5 py-5 bg-[#1a1a1a] border rounded-[10px] cursor-pointer
                                      transition-colors touch-manipulation ${checked ? 'border-[#4caf50]/30' : 'border-[#333] hover:border-[#555]'}`}
                                  >
                                    <div className={`w-10 h-10 rounded-[8px] flex items-center justify-center shrink-0 transition-colors
                                      ${checked ? 'bg-[#0a3d1f] border-2 border-[#4caf50]' : 'bg-[#222] border-2 border-[#555]'}`}>
                                      {checked ? (
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                          <path d="M3.5 8L6.5 11L12.5 5" stroke="#4caf50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                      ) : (
                                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                          <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
                                        </svg>
                                      )}
                                    </div>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleItem(item.id)}
                                      className="hidden"
                                    />
                                    <span className={`text-sm ${checked ? 'text-[#e0e0e0]' : 'text-[#e0e0e0]'}`}>
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
                            className="w-full mt-6 py-4 text-sm font-semibold rounded-[10px] transition-colors touch-manipulation
                                       flex items-center justify-center gap-2
                                       disabled:opacity-50 disabled:cursor-not-allowed bg-white text-black hover:bg-[#ddd]"
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
            </fieldset>

            <div className="text-center pb-6">
              <Link href="/privacy" className="text-[#555] text-[11px] no-underline hover:text-[#888]">
                Privacy Policy
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
