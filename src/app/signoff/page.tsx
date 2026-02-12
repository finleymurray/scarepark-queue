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
  getSignoffStatus,
  SIGNOFF_ROLE_LABELS,
  getTodayDateStr,
} from '@/lib/signoff';
import type {
  Attraction,
  SignoffSection,
  SignoffChecklistItem,
  SignoffCompletion,
  SignoffRoleKey,
} from '@/types/database';
import type { AttractionSignoffStatus, SectionSignoffStatus } from '@/lib/signoff';

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
    if (pin.length >= 6) return;
    setPin((p) => p + d);
    setError('');
  }

  function handleBackspace() {
    setPin((p) => p.slice(0, -1));
    setError('');
  }

  async function handleSubmit() {
    if (pin.length < 4) {
      setError('PIN must be 4-6 digits.');
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

  if (!open) return null;

  const dots = Array.from({ length: 6 }, (_, i) => i < pin.length);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
      <div className="bg-[#1a1a1a] border border-[#444] rounded-xl p-6 w-full max-w-[320px]">
        <p className="text-white text-center text-sm font-semibold mb-1">Enter Your PIN</p>
        <p className="text-[#888] text-center text-xs mb-5">
          Requires: {SIGNOFF_ROLE_LABELS[requiredRole]}
        </p>

        {/* Dots */}
        <div className="flex justify-center gap-3 mb-5">
          {dots.map((filled, i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full border-2 transition-colors ${
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
              className="py-4 text-white text-xl font-medium bg-[#222] rounded-lg hover:bg-[#333] active:bg-[#444] transition-colors"
            >
              {d}
            </button>
          ))}
          <button
            onClick={handleBackspace}
            className="py-4 text-[#888] text-lg bg-[#222] rounded-lg hover:bg-[#333] active:bg-[#444] transition-colors"
          >
            &larr;
          </button>
          <button
            onClick={() => handleDigit('0')}
            className="py-4 text-white text-xl font-medium bg-[#222] rounded-lg hover:bg-[#333] active:bg-[#444] transition-colors"
          >
            0
          </button>
          <button
            onClick={handleSubmit}
            disabled={pin.length < 4 || verifying}
            className="py-4 text-white text-lg font-bold bg-[#1a6b1a] rounded-lg hover:bg-[#228b22] active:bg-[#2aad2a] transition-colors disabled:opacity-40"
          >
            {verifying ? '...' : '\u2713'}
          </button>
        </div>

        <button
          onClick={handleClose}
          className="w-full py-2.5 text-[#888] text-sm hover:text-white transition-colors"
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
    if (completions.has(sectionId)) return; // Already signed off
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

    // Insert completion
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

    // Audit log
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

    // Refresh data
    await fetchData(selectedAttractionId);
  }

  const phaseSections = sections.filter((s) => s.phase === phase);
  const totalSections = phaseSections.length;
  const completedSections = phaseSections.filter((s) => completions.has(s.id)).length;
  const selectedAttraction = attractions.find((a) => a.id === selectedAttractionId);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="text-[#888] text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* PIN Pad */}
      <PinPadModal
        open={showPinPad}
        onVerified={handlePinVerified}
        onCancel={() => { setShowPinPad(false); setPinSectionId(null); }}
        requiredRole={(sections.find((s) => s.id === pinSectionId)?.role_key as SignoffRoleKey) || 'supervisor'}
      />

      {/* Header */}
      <div style={{ background: '#111', borderBottom: '1px solid #333', padding: '12px 0' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Image src="/logo.png" alt="Immersive Core" width={32} height={32} priority style={{ width: 32, height: 'auto' }} />
            <h1 style={{ color: '#fff', fontSize: 18, fontWeight: 600, margin: 0 }}>Sign-Off</h1>
          </div>
          <span className="text-[#888] text-xs">{userEmail}</span>
        </div>
      </div>

      {/* Attraction selector tabs */}
      <div
        className="scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ background: '#111', borderBottom: '1px solid #333', padding: '8px 0', overflowX: 'auto' }}
      >
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 20px', display: 'flex', gap: 4 }}>
          {attractions.map((a) => {
            const active = a.id === selectedAttractionId;
            return (
              <button
                key={a.id}
                onClick={() => setSelectedAttractionId(a.id)}
                style={{
                  color: active ? '#fff' : '#aaa',
                  fontSize: 14,
                  padding: '6px 14px',
                  borderRadius: 6,
                  background: active ? '#222' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.2s, color 0.2s',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {a.name}
              </button>
            );
          })}
        </div>
      </div>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 20px' }}>
        {/* Phase toggle */}
        <div className="flex gap-2 mb-5">
          {(['opening', 'closing'] as const).map((p) => {
            const active = phase === p;
            const pSections = sections.filter((s) => s.phase === p);
            const pCompleted = pSections.filter((s) => completions.has(s.id)).length;
            return (
              <button
                key={p}
                onClick={() => { setPhase(p); setActiveSectionId(null); setCheckedItems(new Set()); }}
                className={`flex-1 py-3 rounded-lg text-sm font-semibold capitalize transition-colors border ${
                  active
                    ? 'bg-[#222] border-[#555] text-white'
                    : 'bg-transparent border-[#333] text-[#888] hover:border-[#555] hover:text-[#ccc]'
                }`}
              >
                {p}
                {pSections.length > 0 && (
                  <span className="ml-2 text-xs opacity-70">
                    {pCompleted}/{pSections.length}
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
              <span className="text-[#888] text-xs">
                {completedSections}/{totalSections} sections signed off
              </span>
              {completedSections === totalSections && (
                <span className="text-[#4caf50] text-xs font-semibold">COMPLETE</span>
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
          <div style={{ background: '#111', border: '1px solid #333', borderRadius: 8, padding: 40, textAlign: 'center' }}>
            <p className="text-[#666] text-sm">No {phase} sections configured for {selectedAttraction?.name || 'this attraction'}.</p>
            <p className="text-[#555] text-xs mt-2">Ask an admin to configure sign-off sections.</p>
          </div>
        )}

        {/* Section cards */}
        {phaseSections.map((section) => {
          const completion = completions.get(section.id);
          const isCompleted = !!completion;
          const isActive = activeSectionId === section.id;
          const sectionItems = items.get(section.id) || [];
          const allChecked = sectionItems.length > 0 && sectionItems.every((i) => checkedItems.has(i.id));

          return (
            <div
              key={section.id}
              style={{
                background: '#111',
                border: `1px solid ${isCompleted ? '#1a4a1a' : isActive ? '#444' : '#333'}`,
                borderRadius: 8,
                marginBottom: 12,
                overflow: 'hidden',
                transition: 'border-color 0.2s',
              }}
            >
              {/* Section header — clickable if not completed */}
              <button
                onClick={() => !isCompleted && openSection(section.id)}
                disabled={isCompleted}
                className="w-full text-left px-4 py-3.5 flex items-center justify-between"
                style={{ background: 'transparent', border: 'none', cursor: isCompleted ? 'default' : 'pointer' }}
              >
                <div className="flex items-center gap-3">
                  {/* Status icon */}
                  {isCompleted ? (
                    <div className="w-7 h-7 rounded-full bg-[#1a4a1a] flex items-center justify-center shrink-0">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M3 7L6 10L11 4" stroke="#4caf50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-full border-2 border-[#444] shrink-0" />
                  )}

                  <div>
                    <span className={`text-sm font-medium ${isCompleted ? 'text-[#4caf50]' : 'text-white'}`}>
                      {section.name}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] px-1.5 py-0.5 bg-[#1a2a3a] text-[#6ea8fe] rounded font-medium">
                        {SIGNOFF_ROLE_LABELS[section.role_key as SignoffRoleKey] || section.role_key}
                      </span>
                      {isCompleted && completion && (
                        <span className="text-[#888] text-[11px]">
                          {completion.signed_by_name} &middot; {new Date(completion.signed_at).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {!isCompleted && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={`transition-transform ${isActive ? 'rotate-180' : ''}`}>
                    <path d="M4 6L8 10L12 6" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>

              {/* Expanded checklist — only when active and not completed */}
              {isActive && !isCompleted && (
                <div className="px-4 pb-4 border-t border-[#222]">
                  {sectionItems.length === 0 ? (
                    <p className="text-[#666] text-sm py-3">No checklist items for this section.</p>
                  ) : (
                    <div className="py-2">
                      {sectionItems.map((item) => {
                        const checked = checkedItems.has(item.id);
                        return (
                          <label
                            key={item.id}
                            className={`flex items-center gap-3 py-3 border-b border-[#222] last:border-0 cursor-pointer transition-colors
                              ${checked ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleItem(item.id)}
                              className="accent-[#4caf50] w-5 h-5 shrink-0"
                            />
                            <span className={`text-sm ${checked ? 'text-[#ccc] line-through' : 'text-white'}`}>
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
                    className="w-full mt-2 py-3 bg-[#1a6b1a] text-white text-sm font-semibold rounded-lg
                               hover:bg-[#228b22] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Sign Off
                  </button>
                </div>
              )}
            </div>
          );
        })}

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Link href="/privacy" style={{ color: '#555', fontSize: 11, textDecoration: 'none' }}>
            Privacy Policy
          </Link>
        </div>
      </main>
    </div>
  );
}
