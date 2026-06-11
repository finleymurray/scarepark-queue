'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppSwitcher from '@/components/AppSwitcher';
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
import ShowReportModal from '@/components/ShowReportModal';
import PinPad from '@/components/ui/PinPad';
import OfflineBanner from '@/components/ui/OfflineBanner';
import { useToasts, ToastStack } from '@/components/ui/Toast';
import {
  surface,
  border,
  text,
  accents,
  radius,
  microLabel,
  FONT_NUM,
  statusColors,
  card,
  controlButton,
} from '@/lib/theme';
import type {
  Attraction,
  SignoffSection,
  SignoffChecklistItem,
  SignoffCompletion,
  SignoffRoleKey,
} from '@/types/database';

const accent = accents.signoff;
const green = statusColors('OPEN');

export default function SignoffPage() {
  const router = useRouter();
  const { toasts, pushToast } = useToasts();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showReportOpen, setShowReportOpen] = useState(false);

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
        router.push('/signoff/login');
        return;
      }
      setUserEmail(auth.email || '');
      setDisplayName(auth.displayName || auth.email || '');
      setUserRole(auth.role);

      let attractionsQuery = supabase
        .from('attractions')
        .select('*')
        .order('sort_order', { ascending: true });

      // Filter to assigned attractions (same as Field Control)
      if (auth.allowedAttractions && auth.allowedAttractions.length > 0) {
        attractionsQuery = attractionsQuery.in('id', auth.allowedAttractions);
      }

      const { data: attractionsData } = await attractionsQuery;

      if (attractionsData && attractionsData.length > 0) {
        setAttractions(attractionsData);
        // Restore last-selected attraction if it's still in the allowed list
        const saved = localStorage.getItem('ic-signoff-selected');
        if (saved && attractionsData.find((a: Attraction) => a.id === saved)) {
          setSelectedAttractionId(saved);
        }
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

  // Realtime subscription for completions — re-subscribes on channel errors
  useEffect(() => {
    if (!selectedAttractionId) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    function subscribeChannel() {
      channel = supabase
        .channel('signoff-completions-live')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'signoff_completions', filter: `attraction_id=eq.${selectedAttractionId}` },
          () => {
            fetchData(selectedAttractionId);
          }
        )
        .subscribe((status) => {
          if (disposed) return;
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            if (channel) supabase.removeChannel(channel);
            channel = null;
            if (retryTimeout) clearTimeout(retryTimeout);
            retryTimeout = setTimeout(() => {
              if (!disposed) subscribeChannel();
            }, 5000);
          }
        });
    }

    subscribeChannel();

    return () => {
      disposed = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      if (channel) supabase.removeChannel(channel);
    };
  }, [selectedAttractionId, fetchData]);

  function selectAttraction(id: string) {
    setSelectedAttractionId(id);
    localStorage.setItem('ic-signoff-selected', id);
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

  /** Check if a section is locked (requires_all_complete and not all other sections done). */
  function isSectionLocked(sectionId: string): boolean {
    const section = sections.find((s) => s.id === sectionId);
    if (!section || !section.requires_all_complete) return false;
    const otherSections = sections.filter((s) => s.phase === section.phase && s.id !== sectionId);
    return otherSections.some((s) => !completions.has(s.id));
  }

  /** Get names of incomplete sections that are blocking this one. */
  function getBlockingSections(sectionId: string): string[] {
    const section = sections.find((s) => s.id === sectionId);
    if (!section || !section.requires_all_complete) return [];
    return sections
      .filter((s) => s.phase === section.phase && s.id !== sectionId && !completions.has(s.id))
      .map((s) => s.name);
  }

  function openSection(sectionId: string) {
    if (completions.has(sectionId)) return;
    if (isSectionLocked(sectionId)) return;
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

  /** Verify PIN (role + attraction access) and, on success, run the completion flow. */
  async function handlePinVerify(pin: string): Promise<boolean> {
    if (!pinSectionId || !selectedAttractionId) return false;

    const requiredRole = (sections.find((s) => s.id === pinSectionId)?.role_key as SignoffRoleKey) || 'supervisor';

    const result = await verifyPin(pin);
    if (!result.valid) return false;
    if (!result.signoffRoles.includes(requiredRole)) return false;
    // Check attraction access — null means all attractions permitted
    if (result.allowedAttractions !== null && !result.allowedAttractions.includes(selectedAttractionId)) {
      return false;
    }

    await completeSignOff(result.userName, result.userEmail);
    return true;
  }

  async function completeSignOff(userName: string, pinUserEmail: string) {
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
      if (process.env.NODE_ENV === 'development') console.error('Sign-off error:', error);
      pushToast('error', 'Could not save sign-off — please try again.');
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

  const pinSection = sections.find((s) => s.id === pinSectionId);
  const pinRequiredRole = (pinSection?.role_key as SignoffRoleKey) || 'supervisor';

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: surface.page }}>
        <div style={{ color: text.muted, fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: surface.page, color: text.primary, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <OfflineBanner />
      <ToastStack toasts={toasts} />

      {/* PIN Pad */}
      {showPinPad && (
        <PinPad
          app="signoff"
          title="Enter Your PIN"
          subtitle={`Requires: ${SIGNOFF_ROLE_LABELS[pinRequiredRole]}`}
          verify={handlePinVerify}
          onCancel={() => { setShowPinPad(false); setPinSectionId(null); }}
        />
      )}

      {/* Header */}
      <div style={{ background: surface.card, borderBottom: `1px solid ${border.default}`, padding: '0 20px', height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AppSwitcher currentApp="signoff" isAdmin={userRole === 'admin'} />
          <a href="/signoff" style={{ textDecoration: 'none' }}>
            <h1 style={{ color: text.primary, fontSize: 15, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>Sign-Off</h1>
          </a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: text.secondary }}>
          {(displayName || userEmail) && (
            <span title={userEmail} className="hidden sm:block" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName || userEmail}
            </span>
          )}
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push('/signoff/login'); }}
            style={{ ...controlButton, padding: '6px 12px', fontSize: 12, fontWeight: 500, minHeight: 40, transition: 'border-color 0.15s, color 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = border.strong; e.currentTarget.style.color = text.primary; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = border.strong; e.currentTarget.style.color = text.secondary; }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Main Content — Scrollable */}
      <div className="flex-1 overflow-y-auto">
        {/* ────────────────────────────────────────────── */}
        {/* Attraction Grid (no attraction selected)      */}
        {/* ────────────────────────────────────────────── */}
        {!selectedAttractionId && (
          <div style={{ maxWidth: 800, margin: '0 auto', width: '100%', padding: '24px 20px' }}>
            <p className="text-sm text-center mb-6" style={{ color: text.muted }}>Select an attraction to begin sign-off</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {attractions.map((a) => {
                const logo = getAttractionLogo(a.slug);
                const glow = getLogoGlow(a.slug);
                const glowRgb = getGlowRgb(a.slug);

                return (
                  <button
                    key={a.id}
                    onClick={() => selectAttraction(a.id)}
                    className="relative overflow-hidden transition-all duration-150 touch-manipulation flex flex-col
                               hover:border-[#F59E0B]/50 active:scale-[0.97]
                               focus:outline-none"
                    style={{ ...card(), borderRadius: radius.xl }}
                  >
                    {/* Logo area */}
                    <div className="relative w-full" style={{ aspectRatio: '1' }}>
                      {glowRgb && (
                        <div
                          className="absolute inset-0"
                          style={{ background: `radial-gradient(circle at center, rgba(${glowRgb}, 0.15) 0%, transparent 70%)` }}
                        />
                      )}
                      <div className="relative z-10 flex items-center justify-center w-full h-full p-4">
                        {logo ? (
                          <img src={logo} alt={a.name} loading="lazy" decoding="async"
                            className="object-contain w-full h-full"
                            style={{ filter: glow || undefined }} />
                        ) : (
                          <span style={{ color: text.secondary, fontSize: 36, fontWeight: 700 }}>{a.name.charAt(0)}</span>
                        )}
                      </div>
                    </div>
                    {/* Name label */}
                    <div className="px-3 pb-4 pt-1 text-center w-full">
                      <span style={{ fontSize: 13, fontWeight: 600, color: text.secondary, lineHeight: 1.3 }}>{a.name}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="text-center pt-10 pb-8">
              <Link href="/privacy" className="text-[11px] no-underline" style={{ color: text.faint }}>
                Privacy Policy
              </Link>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────── */}
        {/* Sign-Off View (attraction selected)           */}
        {/* ────────────────────────────────────────────── */}
        {selectedAttraction && (
          <div style={{ maxWidth: 800, margin: '0 auto', width: '100%', padding: '16px 20px 40px' }}>
            {/* Back button */}
            <button
              onClick={goBackToGrid}
              className="flex items-center gap-2 font-medium mb-6 transition-colors touch-manipulation"
              style={{ color: text.secondary, minHeight: 44, fontSize: 15, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              All Attractions
            </button>

            {/* ── Attraction Logo (centered) ── */}
            {(() => {
              const logo = getAttractionLogo(selectedAttraction.slug);
              const glow = getLogoGlow(selectedAttraction.slug);
              return logo ? (
                <div className="flex justify-center mb-6">
                  <img src={logo} alt={selectedAttraction.name} loading="lazy" decoding="async"
                       className="object-contain w-[100px] sm:w-[140px]"
                       style={{ height: 'auto', maxHeight: 100, filter: glow || undefined }} />
                </div>
              ) : null;
            })()}

            {/* ── Sign-Off Status Badge ── */}
            <div className="mb-8 flex flex-col items-center gap-2">
              {fullySignedOff ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '5px 12px', borderRadius: radius.sm, background: green.soft, color: green.text, border: `1px solid rgba(34,197,94,0.2)` }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Signed Off
                </span>
              ) : openingDone && allClosingSections.length > 0 ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '5px 12px', borderRadius: radius.sm, background: accent.soft, color: accent.base, border: '1px solid rgba(245,158,11,0.2)' }}>
                  Opening Signed Off
                </span>
              ) : allOpeningSections.length > 0 ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '5px 12px', borderRadius: radius.sm, background: statusColors('CLOSED').soft, color: statusColors('CLOSED').rail, border: '1px solid rgba(239,68,68,0.2)' }}>
                  Not Signed Off
                </span>
              ) : null}
              <p className="text-[13px]" style={{ color: text.muted }}>
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            {/* ── Sign-Off Sections ── */}
            <fieldset className="p-4 sm:p-8 mb-8" style={card()}>
              <legend style={{ color: text.primary, fontSize: 15, fontWeight: 600, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, background: accent.base, color: '#000', borderRadius: '50%', fontSize: 13, fontWeight: 700, ...FONT_NUM }}>1</span>
                Sign-Off Sections
              </legend>

              {/* Phase tabs */}
              <div className="flex mb-6" style={{ borderBottom: `1px solid ${border.default}` }}>
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
                      className="flex-1 flex items-center justify-center gap-2 font-semibold transition-colors touch-manipulation relative"
                      style={{
                        padding: '16px 8px', fontSize: 15, minHeight: 52,
                        background: 'none', border: 'none',
                        color: closingLocked ? text.faint : active ? text.primary : text.secondary,
                        cursor: closingLocked ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {closingLocked && (
                        <svg width="15" height="15" viewBox="0 0 12 12" fill="none">
                          <rect x="2" y="5.5" width="8" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                          <path d="M4 5.5V3.5C4 2.4 4.9 1.5 6 1.5C7.1 1.5 8 2.4 8 3.5V5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
                        </svg>
                      )}
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                      {pSections.length > 0 && !closingLocked && (
                        <span className="text-sm font-medium" style={{ color: active ? text.muted : text.faint, ...FONT_NUM }}>
                          {allDone ? '✓' : `${pCompleted}/${pSections.length}`}
                        </span>
                      )}
                      {active && <span className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full" style={{ background: accent.base }} />}
                    </button>
                  );
                })}
              </div>

              {/* Progress bar */}
              {totalSections > 0 && (
                <div style={{ background: surface.control, border: `1px solid ${border.default}`, borderRadius: radius.lg, padding: '16px 20px', marginBottom: 20 }}>
                  <div className="flex items-center justify-between mb-3">
                    <span style={{ color: text.secondary, fontSize: 15, fontWeight: 500, ...FONT_NUM }}>
                      {completedSections}/{totalSections} sections signed off
                    </span>
                    {completedSections === totalSections && (
                      <span style={{ ...microLabel, fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: radius.pill, background: green.soft, color: green.text }}>COMPLETE</span>
                    )}
                  </div>
                  <div style={{ position: 'relative', width: '100%', height: 10, background: surface.raised, borderRadius: radius.pill, overflow: 'visible' }}>
                    {/* Glow layer */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        height: '100%',
                        borderRadius: radius.pill,
                        width: `${(completedSections / totalSections) * 100}%`,
                        background: completedSections === totalSections
                          ? green.rail
                          : `linear-gradient(90deg, ${accent.strong}, ${accent.base})`,
                        filter: 'blur(8px)',
                        opacity: 0.5,
                        transition: 'width 0.5s ease',
                      }}
                    />
                    {/* Fill layer */}
                    <div
                      style={{
                        position: 'relative',
                        height: '100%',
                        borderRadius: radius.pill,
                        width: `${(completedSections / totalSections) * 100}%`,
                        background: completedSections === totalSections
                          ? green.rail
                          : `linear-gradient(90deg, ${accent.strong} 0%, ${accent.base} 100%)`,
                        transition: 'width 0.5s ease',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* No sections message */}
              {totalSections === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm" style={{ color: text.muted }}>No {phase} sections configured for {selectedAttraction?.name || 'this attraction'}.</p>
                  <p className="text-[13px] mt-2" style={{ color: text.faint }}>Ask an admin to configure sign-off sections.</p>
                </div>
              )}

              {/* Section cards */}
              <div className="flex flex-col" style={{ gap: 12 }}>
                {phaseSections.map((section, idx) => {
                  const completion = completions.get(section.id);
                  const isCompleted = !!completion;
                  const isActive = activeSectionId === section.id;
                  const sectionItems = items.get(section.id) || [];
                  const allChecked = sectionItems.length > 0 && sectionItems.every((i) => checkedItems.has(i.id));
                  const locked = isSectionLocked(section.id);
                  const blockingNames = locked ? getBlockingSections(section.id) : [];

                  return (
                    <div
                      key={section.id}
                      className="transition-colors"
                      style={{
                        background: isCompleted ? green.soft : surface.control,
                        borderRadius: radius.lg,
                        overflow: 'hidden',
                        opacity: locked ? 0.6 : 1,
                        border: `1px solid ${isCompleted ? 'rgba(34,197,94,0.3)' : isActive ? 'rgba(245,158,11,0.5)' : border.default}`,
                      }}
                    >
                      {/* Section header — clickable if not completed and not locked */}
                      <button
                        onClick={() => !isCompleted && !locked && openSection(section.id)}
                        disabled={isCompleted || locked}
                        className="w-full text-left px-6 py-6 flex items-center justify-between touch-manipulation bg-transparent border-none"
                        style={{ cursor: isCompleted || locked ? 'default' : 'pointer' }}
                      >
                        <div className="flex items-center gap-4">
                          {isCompleted ? (
                            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(34,197,94,0.18)' }}>
                              <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                                <path d="M3 7L6 10L11 4" stroke={green.rail} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                          ) : locked ? (
                            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: surface.raised, border: `2px solid ${border.strong}` }}>
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <rect x="3" y="7" width="10" height="7" rx="1.5" stroke={text.faint} strokeWidth="1.5" fill="none"/>
                                <path d="M5 7V5C5 3.34 6.34 2 8 2C9.66 2 11 3.34 11 5V7" stroke={text.faint} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                              </svg>
                            </div>
                          ) : (
                            <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold" style={{ background: accent.soft, color: accent.base, border: '2px solid rgba(245,158,11,0.3)', ...FONT_NUM }}>
                              {idx + 1}
                            </span>
                          )}

                          <div>
                            <span style={{ fontSize: 15, fontWeight: 600, color: isCompleted ? green.rail : locked ? text.faint : text.primary }}>
                              {section.name}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[12px] font-medium" style={{ color: text.muted }}>
                                {SIGNOFF_ROLE_LABELS[section.role_key as SignoffRoleKey] || section.role_key}
                              </span>
                              {isCompleted && completion && (
                                <span className="text-[11px]" style={{ color: text.muted }}>
                                  &middot; {completion.signed_by_name} &middot; {new Date(completion.signed_at).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                </span>
                              )}
                              {locked && (
                                <span className="text-[11px]" style={{ color: accent.text }}>
                                  &middot; Waiting for {blockingNames.join(', ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {!isCompleted && !locked && (
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={`transition-transform shrink-0 ${isActive ? 'rotate-180' : ''}`}>
                            <path d="M4 6L8 10L12 6" stroke={text.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>

                      {/* Expanded checklist */}
                      {isActive && !isCompleted && (
                        <div style={{ borderTop: `1px solid ${border.divider}` }}>
                          {sectionItems.length === 0 ? (
                            <p className="text-sm py-6 px-6" style={{ color: text.muted }}>No checklist items for this section.</p>
                          ) : (
                            <div className="px-4 pt-4 pb-2 flex flex-col gap-3">
                              {sectionItems.map((item) => {
                                const checked = checkedItems.has(item.id);
                                return (
                                  <label
                                    key={item.id}
                                    style={{ minHeight: 64, borderRadius: radius.lg, border: checked ? '1px solid rgba(34,197,94,0.4)' : `1px solid ${border.default}`, background: checked ? green.soft : surface.card, display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', cursor: 'pointer' }}
                                    className="transition-all touch-manipulation"
                                  >
                                    <input type="checkbox" checked={checked} onChange={() => toggleItem(item.id)} className="hidden" />
                                    <div style={{ width: 56, height: 30, borderRadius: 15, background: checked ? green.rail : surface.raised, border: `2px solid ${checked ? green.rail : border.strong}`, position: 'relative', flexShrink: 0, transition: 'background 0.2s, border-color 0.2s' }}>
                                      <div style={{ position: 'absolute', top: 2, left: checked ? 26 : 2, width: 22, height: 22, borderRadius: '50%', background: checked ? '#fff' : text.faint, boxShadow: '0 1px 4px rgba(0,0,0,0.5)', transition: 'left 0.18s ease, background 0.2s' }} />
                                    </div>
                                    <span style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.3, flex: 1, color: checked ? green.text : text.primary }}>
                                      {item.label}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          )}

                          {/* Sign off button — sticky at bottom */}
                          <div className="sticky bottom-0 px-4 py-4" style={{ background: `linear-gradient(to bottom, transparent 0%, ${surface.control} 30%)` }}>
                            {sectionItems.length > 0 && !allChecked && (
                              <p className="text-[13px] text-center mb-3" style={{ color: text.faint, ...FONT_NUM }}>
                                {sectionItems.length - Array.from(checkedItems).filter(id => sectionItems.some(i => i.id === id)).length} item{sectionItems.length - Array.from(checkedItems).filter(id => sectionItems.some(i => i.id === id)).length !== 1 ? 's' : ''} remaining
                              </p>
                            )}
                            <button
                              onClick={() => handleSignOffClick(section.id)}
                              disabled={!allChecked && sectionItems.length > 0}
                              className="w-full text-base font-bold transition-all touch-manipulation
                                         flex items-center justify-center gap-3
                                         disabled:opacity-25 disabled:cursor-not-allowed"
                              style={{
                                background: allChecked || sectionItems.length === 0
                                  ? `linear-gradient(135deg, ${accent.strong} 0%, ${accent.base} 100%)`
                                  : surface.card,
                                border: allChecked || sectionItems.length === 0 ? 'none' : `1px solid ${border.default}`,
                                borderRadius: radius.xl,
                                color: allChecked || sectionItems.length === 0 ? '#000' : text.faint,
                                minHeight: 64,
                                fontSize: 17,
                                cursor: 'pointer',
                                boxShadow: allChecked || sectionItems.length === 0 ? '0 6px 24px rgba(245,158,11,0.3)' : 'none',
                              }}
                            >
                              <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                                <path d="M3.5 8L6.5 11L12.5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              Sign Off with PIN
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </fieldset>

            {/* ── Separator ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '8px 0 16px' }}>
              <div style={{ flex: 1, height: 1, background: border.default }} />
              <span style={{ ...microLabel, color: text.secondary, fontSize: 11, flexShrink: 0 }}>End of Night</span>
              <div style={{ flex: 1, height: 1, background: border.default }} />
            </div>

            {/* ── End of Night Report Button ── */}
            <fieldset className="p-4 sm:p-8 mb-8" style={card()}>
              <legend style={{ color: text.primary, fontSize: 15, fontWeight: 600, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, background: accent.base, color: '#000', borderRadius: '50%', fontSize: 13, fontWeight: 700, ...FONT_NUM }}>2</span>
                Show Report
              </legend>
              <p style={{ color: text.secondary, fontSize: 14, marginBottom: 16 }}>
                Submit an end-of-night report for {selectedAttraction?.name || 'this attraction'}.
              </p>
              <button
                onClick={() => setShowReportOpen(true)}
                style={{
                  ...controlButton,
                  width: '100%',
                  padding: '18px 24px',
                  borderRadius: radius.lg,
                  color: text.primary,
                  fontSize: 16,
                  fontWeight: 600,
                  minHeight: 60,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                End of Night Report
              </button>
            </fieldset>

            {/* Show Report Modal */}
            <ShowReportModal
              open={showReportOpen}
              attractionId={selectedAttractionId}
              attractionName={selectedAttraction?.name || ''}
              dateStr={getTodayDateStr()}
              userEmail={userEmail}
              displayName={displayName}
              onClose={() => setShowReportOpen(false)}
              onSubmitted={() => setShowReportOpen(false)}
            />

            <div className="text-center pb-6">
              <Link href="/privacy" className="text-[11px] no-underline" style={{ color: text.faint }}>
                Privacy Policy
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
