'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppSwitcher from '@/components/AppSwitcher';
import { supabase } from '@/lib/supabase';
import { checkAuth, clearAuthCache } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import {
  verifyPin,
  SIGNOFF_ROLE_LABELS,
  getTodayDateStr,
} from '@/lib/signoff';
import { resolveLogo, resolveGlowRgb, resolveLogoGlow } from '@/lib/logos';
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
  controlButton,
  primaryButton,
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
const TRACK = '#1C1F26';

/* ── Small SVG progress ring ── */
function ProgressRing({ size, pct, showPct = true }: { size: number; pct: number; showPct?: boolean }) {
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const done = clamped >= 100;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TRACK} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={done ? green.rail : accent.base}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped / 100)}
          style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.3s ease' }}
        />
      </svg>
      {showPct && (
        <span style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size >= 44 ? 11 : 10, fontWeight: 600, color: done ? green.text : accent.text, ...FONT_NUM,
        }}>
          {Math.round(clamped)}%
        </span>
      )}
    </div>
  );
}

/* ── Tinted logo square for attraction rows ── */
function LogoSquare({ a }: { a: Attraction }) {
  const logo = resolveLogo(a);
  const glowRgb = resolveGlowRgb(a) || '148, 163, 184';
  return (
    <div style={{
      width: 44, height: 44, borderRadius: 10, flexShrink: 0,
      background: `rgba(${glowRgb}, 0.10)`,
      border: `1px solid rgba(${glowRgb}, 0.18)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    }}>
      {logo ? (
        <img src={logo} alt={a.name} loading="lazy" decoding="async"
          style={{ width: '85%', height: '85%', objectFit: 'contain' }} />
      ) : (
        <span style={{ color: `rgba(${glowRgb}, 0.9)`, fontSize: 15, fontWeight: 700 }}>
          {a.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
        </span>
      )}
    </div>
  );
}

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

  // Sections + items + completions (selected attraction)
  const [sections, setSections] = useState<SignoffSection[]>([]);
  const [items, setItems] = useState<Map<string, SignoffChecklistItem[]>>(new Map());
  const [completions, setCompletions] = useState<Map<string, SignoffCompletion>>(new Map());

  // Home dashboard overview — sections + today's completions across all allowed attractions
  const [overviewSections, setOverviewSections] = useState<SignoffSection[]>([]);
  const [overviewCompletions, setOverviewCompletions] = useState<SignoffCompletion[]>([]);

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

  /** Read-only overview fetch for the home dashboard (per-attraction progress). */
  const fetchOverview = useCallback(async (attractionIds: string[]) => {
    if (attractionIds.length === 0) return;
    const today = getTodayDateStr();
    const [sectionsRes, completionsRes] = await Promise.all([
      supabase
        .from('signoff_sections')
        .select('*')
        .in('attraction_id', attractionIds)
        .order('sort_order', { ascending: true }),
      supabase
        .from('signoff_completions')
        .select('*')
        .in('attraction_id', attractionIds)
        .eq('sign_date', today),
    ]);
    setOverviewSections(sectionsRes.data || []);
    setOverviewCompletions(completionsRes.data || []);
  }, []);

  useEffect(() => {
    async function init() {
      const auth = await checkAuth();
      if (!auth.authenticated) {
        window.location.href = '/signoff/login';
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
        // Always open on the attraction grid (home), never auto-jump into a
        // remembered attraction — staff found that disorienting.
        fetchOverview(attractionsData.map((a: Attraction) => a.id));
      }

      setLoading(false);
    }
    init();
  }, [router, fetchOverview]);

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
    // Refresh the dashboard so home progress reflects what was just signed off
    fetchOverview(attractions.map((a) => a.id));
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

  /* ── Home dashboard derived data ── */
  const completedSectionIds = new Set(overviewCompletions.map((c) => c.section_id));

  /** Per-phase readiness: attraction is phase-ready when ALL its sections in that
   *  phase are completed today. Attractions with no sections in a phase don't
   *  count toward that phase's denominator. */
  function phaseReadiness(p: 'opening' | 'closing') {
    let total = 0;
    let ready = 0;
    for (const a of attractions) {
      const secs = overviewSections.filter((s) => s.attraction_id === a.id && s.phase === p);
      if (secs.length === 0) continue;
      total += 1;
      if (secs.every((s) => completedSectionIds.has(s.id))) ready += 1;
    }
    return { ready, total };
  }
  const openingReadiness = phaseReadiness('opening');
  const closingReadiness = phaseReadiness('closing');
  // Overall night progress across both phases (for the header ring)
  const parkDone = overviewSections.filter((s) => completedSectionIds.has(s.id)).length;
  const parkPct = overviewSections.length > 0 ? (parkDone / overviewSections.length) * 100 : 0;

  const detailPct = totalSections > 0 ? (completedSections / totalSections) * 100 : 0;
  const selectedGlowRgb = selectedAttraction ? (resolveGlowRgb(selectedAttraction) || '148, 163, 184') : '148, 163, 184';

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

      {/* Top bar */}
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
            onClick={async () => { clearAuthCache(); await supabase.auth.signOut(); window.location.href = '/signoff/login'; }}
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
        {/* Home dashboard (no attraction selected)        */}
        {/* ────────────────────────────────────────────── */}
        {!selectedAttractionId && (
          <div style={{ maxWidth: 680, margin: '0 auto', width: '100%', padding: '24px 20px' }}>
            {/* Dashboard header + night progress ring */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 500, letterSpacing: '-0.02em', color: text.primary }}>Sign-Off</h2>
                <p style={{ margin: '3px 0 0', fontSize: 11, color: text.muted }}>
                  {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · Tonight&rsquo;s checks
                </p>
              </div>
              <ProgressRing size={46} pct={parkPct} />
            </div>

            {/* Phase readiness summary — opening / closing stat blocks */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              {([
                { label: 'Opening', r: openingReadiness },
                { label: 'Closing', r: closingReadiness },
              ] as const).map(({ label, r }) => {
                const allReady = r.total > 0 && r.ready === r.total;
                return (
                  <div
                    key={label}
                    style={{
                      flex: 1,
                      background: surface.control,
                      border: `1px solid ${allReady ? 'rgba(34,197,94,0.3)' : border.default}`,
                      borderRadius: 12,
                      padding: '10px 14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', color: text.secondary }}>
                      {label}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: allReady ? green.text : accent.text, ...FONT_NUM }}>
                      {r.ready}/{r.total} <span style={{ fontSize: 10, fontWeight: 500, color: text.muted }}>ready</span>
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Attraction tiles — square, art-washed, logo-forward */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
              {attractions.map((a) => {
                const glowRgb = resolveGlowRgb(a) || '148, 163, 184';
                const logo = resolveLogo(a);

                return (
                  <button
                    key={a.id}
                    onClick={() => selectAttraction(a.id)}
                    className="touch-manipulation"
                    style={{
                      aspectRatio: '1',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      padding: 12,
                      borderRadius: 16,
                      border: `1px solid ${border.default}`,
                      background: `linear-gradient(135deg, rgba(${glowRgb}, 0.16) 0%, #0A0B0E 70%)`,
                      cursor: 'pointer',
                      transition: 'border-color 0.15s',
                      overflow: 'hidden',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = `rgba(${glowRgb}, 0.35)`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = border.default; }}
                    onTouchStart={(e) => { e.currentTarget.style.borderColor = `rgba(${glowRgb}, 0.35)`; }}
                    onTouchEnd={(e) => { e.currentTarget.style.borderColor = border.default; }}
                  >
                    {logo ? (
                      <>
                        <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
                          <img
                            src={logo} alt={a.name} loading="lazy" decoding="async"
                            style={{ width: '70%', maxHeight: '100%', objectFit: 'contain', filter: resolveLogoGlow(a) }}
                          />
                        </div>
                        <span style={{
                          fontSize: 11, color: text.secondary, textAlign: 'center', width: '100%',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0, marginTop: 6,
                        }}>
                          {a.name}
                        </span>
                      </>
                    ) : (
                      <span style={{ fontSize: 16, fontWeight: 600, color: text.primary, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {a.name}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="text-center pt-10 pb-8">
              <a href="/privacy" className="text-[11px] no-underline" style={{ color: text.faint }}>
                Privacy Policy
              </a>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────── */}
        {/* Attraction detail (checklist)                  */}
        {/* ────────────────────────────────────────────── */}
        {selectedAttraction && (
          <div>
            {/* Hero header with attraction tint */}
            <div style={{ background: `linear-gradient(160deg, rgba(${selectedGlowRgb}, 0.14) 0%, ${surface.page} 70%)` }}>
              <div style={{ maxWidth: 680, margin: '0 auto', width: '100%', padding: '14px 20px 18px' }}>
                <button
                  onClick={goBackToGrid}
                  className="touch-manipulation"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: text.muted, background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', minHeight: 36 }}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  All attractions
                </button>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                    <LogoSquare a={selectedAttraction} />
                    <div style={{ minWidth: 0 }}>
                      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em', color: text.primary }}>
                        {selectedAttraction.name}
                      </h2>
                      <p style={{ margin: '3px 0 0', fontSize: 11, color: fullySignedOff ? green.text : accent.text, ...FONT_NUM }}>
                        {fullySignedOff
                          ? 'All checks signed off'
                          : `${phase.charAt(0).toUpperCase() + phase.slice(1)} checks · ${completedSections} of ${totalSections} sections`}
                      </p>
                    </div>
                  </div>
                  <ProgressRing size={40} pct={detailPct} />
                </div>
              </div>
            </div>

            <div style={{ maxWidth: 680, margin: '0 auto', width: '100%', padding: '4px 20px 40px' }}>
              {/* Phase switch — segmented control */}
              <div style={{ display: 'flex', gap: 6, background: surface.control, border: `1px solid ${border.default}`, borderRadius: 12, padding: 4, marginBottom: 16 }}>
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
                      className="touch-manipulation"
                      style={{
                        flex: 1, minHeight: 44, borderRadius: 9, border: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        fontSize: 13, fontWeight: 600,
                        background: active ? surface.raised : 'transparent',
                        color: closingLocked ? text.faint : active ? text.primary : text.muted,
                        cursor: closingLocked ? 'not-allowed' : 'pointer',
                        transition: 'background 0.15s, color 0.15s',
                        boxShadow: active ? `inset 0 0 0 1px ${border.strong}` : 'none',
                      }}
                    >
                      {closingLocked && (
                        <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                          <rect x="2" y="5.5" width="8" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
                          <path d="M4 5.5V3.5C4 2.4 4.9 1.5 6 1.5C7.1 1.5 8 2.4 8 3.5V5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" />
                        </svg>
                      )}
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                      {pSections.length > 0 && !closingLocked && (
                        <span style={{ fontSize: 11, fontWeight: 500, color: allDone ? green.text : active ? accent.text : text.faint, ...FONT_NUM }}>
                          {allDone ? '✓' : `${pCompleted}/${pSections.length}`}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Closing locked affordance (visible while on opening, closing exists) */}
              {phase === 'opening' && !openingDone && allClosingSections.length > 0 && (
                <div style={{
                  border: `1px dashed ${border.strong}`, borderRadius: 14, padding: '12px 16px',
                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
                }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <rect x="3" y="7" width="10" height="7" rx="1.5" stroke={text.faint} strokeWidth="1.5" fill="none" />
                    <path d="M5 7V5C5 3.34 6.34 2 8 2C9.66 2 11 3.34 11 5V7" stroke={text.faint} strokeWidth="1.5" strokeLinecap="round" fill="none" />
                  </svg>
                  <span style={{ fontSize: 11, color: text.faint }}>
                    Closing checks — available after opening complete
                  </span>
                </div>
              )}

              {/* No sections message */}
              {totalSections === 0 && (
                <div className="text-center py-10" style={{ border: `1px dashed ${border.strong}`, borderRadius: 14 }}>
                  <p className="text-sm" style={{ color: text.muted }}>No {phase} sections configured for {selectedAttraction?.name || 'this attraction'}.</p>
                  <p className="text-[13px] mt-2" style={{ color: text.faint }}>Ask an admin to configure sign-off sections.</p>
                </div>
              )}

              {/* Section list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {phaseSections.map((section) => {
                  const completion = completions.get(section.id);
                  const isCompleted = !!completion;
                  const isActive = activeSectionId === section.id;
                  const sectionItems = items.get(section.id) || [];
                  const allChecked = sectionItems.length > 0 && sectionItems.every((i) => checkedItems.has(i.id));
                  const locked = isSectionLocked(section.id);
                  const blockingNames = locked ? getBlockingSections(section.id) : [];
                  const checkedCount = sectionItems.filter((i) => checkedItems.has(i.id)).length;
                  const canSign = allChecked || sectionItems.length === 0;

                  /* ── Completed: green receipt ── */
                  if (isCompleted && completion) {
                    return (
                      <div
                        key={section.id}
                        style={{
                          borderRadius: 14,
                          border: '1px solid rgba(34,197,94,0.25)',
                          background: 'rgba(34,197,94,0.06)',
                          padding: '12px 16px',
                          display: 'flex', alignItems: 'center', gap: 12,
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                          <circle cx="8" cy="8" r="7" stroke={green.rail} strokeWidth="1.4" />
                          <path d="M5 8.2L7.2 10.4L11 5.8" stroke={green.rail} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#86EFAC' }}>{section.name}</div>
                          <div style={{ fontSize: 10, color: '#4D7C5F', marginTop: 2, ...FONT_NUM }}>
                            {completion.signed_by_name} · {new Date(completion.signed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {SIGNOFF_ROLE_LABELS[section.role_key as SignoffRoleKey] || section.role_key}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  /* ── Locked: dashed waiting row ── */
                  if (locked) {
                    return (
                      <div
                        key={section.id}
                        style={{
                          border: `1px dashed ${border.strong}`, borderRadius: 14,
                          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
                        }}
                      >
                        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                          <rect x="3" y="7" width="10" height="7" rx="1.5" stroke={text.faint} strokeWidth="1.5" fill="none" />
                          <path d="M5 7V5C5 3.34 6.34 2 8 2C9.66 2 11 3.34 11 5V7" stroke={text.faint} strokeWidth="1.5" strokeLinecap="round" fill="none" />
                        </svg>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: text.faint }}>{section.name}</div>
                          <div style={{ fontSize: 11, color: accent.text, marginTop: 2 }}>
                            Waiting for {blockingNames.join(', ')}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  /* ── Incomplete: working card (expands when active) ── */
                  return (
                    <div
                      key={section.id}
                      style={{
                        background: surface.card,
                        borderRadius: 14,
                        border: `1px solid ${isActive ? 'rgba(245,158,11,0.45)' : border.strong}`,
                        overflow: 'hidden',
                        transition: 'border-color 0.15s',
                      }}
                    >
                      <button
                        onClick={() => (isActive ? setActiveSectionId(null) : openSection(section.id))}
                        className="w-full text-left touch-manipulation"
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 56 }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <span style={{ fontSize: 14, fontWeight: 500, color: text.primary }}>{section.name}</span>
                          <div style={{ fontSize: 11, color: text.muted, marginTop: 2 }}>
                            {SIGNOFF_ROLE_LABELS[section.role_key as SignoffRoleKey] || section.role_key}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                          {isActive && sectionItems.length > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 600, color: accent.text, ...FONT_NUM }}>
                              {checkedCount} of {sectionItems.length}
                            </span>
                          )}
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={`transition-transform ${isActive ? 'rotate-180' : ''}`}>
                            <path d="M4 6L8 10L12 6" stroke={text.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      </button>

                      {/* Expanded checklist */}
                      {isActive && (
                        <div style={{ borderTop: `1px solid ${border.divider}` }}>
                          {sectionItems.length === 0 ? (
                            <p className="text-sm py-5 px-4" style={{ color: text.muted }}>No checklist items for this section.</p>
                          ) : (
                            <div style={{ padding: '12px 12px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {sectionItems.map((item) => {
                                const checked = checkedItems.has(item.id);
                                return (
                                  <label
                                    key={item.id}
                                    className="touch-manipulation"
                                    style={{
                                      minHeight: 64, borderRadius: 10,
                                      border: checked ? '1px solid rgba(34,197,94,0.4)' : `1px solid ${border.default}`,
                                      background: checked ? green.soft : surface.control,
                                      display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px',
                                      cursor: 'pointer',
                                      transition: 'background 0.15s, border-color 0.15s',
                                    }}
                                  >
                                    <input type="checkbox" checked={checked} onChange={() => toggleItem(item.id)} className="hidden" />
                                    <div style={{ width: 56, height: 30, borderRadius: 15, background: checked ? green.rail : surface.raised, border: `2px solid ${checked ? green.rail : border.strong}`, position: 'relative', flexShrink: 0, transition: 'background 0.2s, border-color 0.2s' }}>
                                      <div style={{ position: 'absolute', top: 2, left: checked ? 26 : 2, width: 22, height: 22, borderRadius: '50%', background: checked ? '#fff' : text.faint, boxShadow: '0 1px 4px rgba(0,0,0,0.5)', transition: 'left 0.18s ease, background 0.2s' }} />
                                    </div>
                                    <span style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.35, flex: 1, color: checked ? green.text : text.primary }}>
                                      {item.label}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          )}

                          {/* Sign-off footer */}
                          <div className="sticky bottom-0" style={{ padding: '12px 12px 14px', background: `linear-gradient(to bottom, transparent 0%, ${surface.card} 35%)` }}>
                            <button
                              onClick={() => handleSignOffClick(section.id)}
                              disabled={!canSign}
                              className="w-full touch-manipulation flex items-center justify-center gap-3"
                              style={{
                                ...primaryButton('signoff'),
                                minHeight: 60,
                                fontSize: 15,
                                opacity: canSign ? 1 : 0.45,
                                cursor: canSign ? 'pointer' : 'not-allowed',
                                transition: 'opacity 0.15s, background 0.15s',
                                boxShadow: canSign ? '0 6px 20px rgba(245,158,11,0.25)' : 'none',
                              }}
                            >
                              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                                <path d="M3.5 8L6.5 11L12.5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              Sign off section · enter PIN
                            </button>
                            {sectionItems.length > 0 && !allChecked && (
                              <p className="text-center" style={{ fontSize: 11, color: text.faint, marginTop: 8, ...FONT_NUM }}>
                                {sectionItems.length - checkedCount} item{sectionItems.length - checkedCount !== 1 ? 's' : ''} remaining
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ── End of night ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '28px 0 14px' }}>
                <div style={{ flex: 1, height: 1, background: border.default }} />
                <span style={{ ...microLabel, color: text.secondary, fontSize: 11, flexShrink: 0 }}>End of Night</span>
                <div style={{ flex: 1, height: 1, background: border.default }} />
              </div>

              <button
                onClick={() => setShowReportOpen(true)}
                className="touch-manipulation"
                style={{
                  ...controlButton,
                  width: '100%',
                  padding: '16px 24px',
                  borderRadius: 14,
                  color: text.primary,
                  fontSize: 15,
                  fontWeight: 600,
                  minHeight: 60,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = surface.raised; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = surface.control; }}
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

              <div className="text-center pt-8 pb-6">
                <a href="/privacy" className="text-[11px] no-underline" style={{ color: text.faint }}>
                  Privacy Policy
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
