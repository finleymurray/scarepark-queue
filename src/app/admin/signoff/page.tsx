'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { checkAuth } from '@/lib/auth';
import AdminNav from '@/components/AdminNav';
import { ALL_SIGNOFF_ROLES, SIGNOFF_ROLE_LABELS, getTodayDateStr } from '@/lib/signoff';
import type { Attraction, SignoffSection, SignoffChecklistItem, SignoffCompletion, SignoffRoleKey } from '@/types/database';

/* ── Confirm Modal ── */
function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="bg-[#1a1a1a] border border-[#444] rounded-lg p-6 w-full max-w-[400px]">
        <p className="text-[#ccc] text-sm mb-1">
          <strong className="text-white">{title}</strong>
        </p>
        <p className="text-[#ccc] text-sm mb-5">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-5 py-2.5 bg-transparent border border-[#555] text-[#ccc] hover:border-[#888] hover:text-white
                       rounded-md text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-5 py-2.5 bg-[#d43518] hover:bg-[#b52d14] text-white rounded-md
                       text-sm font-semibold transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const PHASES = ['opening', 'closing'] as const;
type Phase = (typeof PHASES)[number];
type AdminTab = 'config' | 'history';

/* ────────────────────────────────────────────────────────── */
/* ── History Tab Component                                 ── */
/* ────────────────────────────────────────────────────────── */
function SignoffHistoryTab({
  attractions,
}: {
  attractions: Attraction[];
}) {
  const [selectedDate, setSelectedDate] = useState(getTodayDateStr());
  const [selectedAttractionId, setSelectedAttractionId] = useState<string>('all');
  const [allSections, setAllSections] = useState<SignoffSection[]>([]);
  const [completions, setCompletions] = useState<SignoffCompletion[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const attractionMap = new Map(attractions.map((a) => [a.id, a]));

  const fetchHistory = useCallback(async (date: string, attractionId: string) => {
    setLoadingHistory(true);

    // Fetch all sections (needed to know what's "waiting")
    let sectionsQuery = supabase.from('signoff_sections').select('*').order('sort_order', { ascending: true });
    if (attractionId !== 'all') {
      sectionsQuery = sectionsQuery.eq('attraction_id', attractionId);
    }
    const { data: secs } = await sectionsQuery;

    // Fetch completions for the selected date
    let completionsQuery = supabase.from('signoff_completions').select('*').eq('sign_date', date);
    if (attractionId !== 'all') {
      completionsQuery = completionsQuery.eq('attraction_id', attractionId);
    }
    const { data: comps } = await completionsQuery;

    setAllSections(secs || []);
    setCompletions(comps || []);
    setLoadingHistory(false);
  }, []);

  useEffect(() => {
    fetchHistory(selectedDate, selectedAttractionId);
  }, [selectedDate, selectedAttractionId, fetchHistory]);

  // Realtime subscription for completions on the selected date
  useEffect(() => {
    const channel = supabase
      .channel('admin-signoff-history')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'signoff_completions' },
        () => {
          fetchHistory(selectedDate, selectedAttractionId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate, selectedAttractionId, fetchHistory]);

  const isToday = selectedDate === getTodayDateStr();

  // Build completion lookup by section_id
  const completionMap = new Map<string, SignoffCompletion>();
  for (const c of completions) {
    completionMap.set(c.section_id, c);
  }

  // Group sections by attraction, then by phase
  const attractionIds = [...new Set(allSections.map((s) => s.attraction_id))];

  // Sort by attraction sort_order
  attractionIds.sort((a, b) => {
    const aa = attractionMap.get(a);
    const bb = attractionMap.get(b);
    return (aa?.sort_order || 0) - (bb?.sort_order || 0);
  });

  // Summary stats
  const totalSections = allSections.length;
  const completedSections = allSections.filter((s) => completionMap.has(s.id)).length;
  const waitingSections = totalSections - completedSections;

  return (
    <>
      {/* Filters */}
      <div style={{ background: '#111', border: '1px solid #333', borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <label className="text-[#ccc] text-sm font-medium shrink-0">Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2.5 bg-[#1a1a1a] border border-[#444] rounded-md text-[#e0e0e0] text-sm
                       focus:outline-none focus:border-[#6ea8fe] transition-colors"
          />
          {!isToday && (
            <button
              onClick={() => setSelectedDate(getTodayDateStr())}
              className="px-3 py-2 bg-transparent border border-[#555] text-[#ccc] text-xs font-medium rounded-md
                         hover:border-[#888] hover:text-white transition-colors"
            >
              Today
            </button>
          )}
          <div className="w-px h-6 bg-[#333] hidden sm:block" />
          <label className="text-[#ccc] text-sm font-medium shrink-0">Attraction:</label>
          <select
            value={selectedAttractionId}
            onChange={(e) => setSelectedAttractionId(e.target.value)}
            className="flex-1 px-3 py-2.5 bg-[#1a1a1a] border border-[#444] rounded-md text-[#e0e0e0] text-sm
                       focus:outline-none focus:border-[#6ea8fe] transition-colors"
          >
            <option value="all">All Attractions</option>
            {attractions.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary bar */}
      <div style={{ background: '#111', border: '1px solid #333', borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <span className="text-[#888] text-xs uppercase tracking-wider">Total</span>
            <div className="text-white text-xl font-bold">{totalSections}</div>
          </div>
          <div>
            <span className="text-[#888] text-xs uppercase tracking-wider">Completed</span>
            <div className="text-[#4caf50] text-xl font-bold">{completedSections}</div>
          </div>
          <div>
            <span className="text-[#888] text-xs uppercase tracking-wider">Waiting</span>
            <div className={`text-xl font-bold ${waitingSections > 0 ? 'text-[#f0ad4e]' : 'text-[#4caf50]'}`}>{waitingSections}</div>
          </div>
          {totalSections > 0 && (
            <div className="flex-1 min-w-[120px]">
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
        </div>
      </div>

      {loadingHistory && (
        <div className="text-[#888] text-sm text-center py-8">Loading...</div>
      )}

      {!loadingHistory && totalSections === 0 && (
        <div style={{ background: '#111', border: '1px solid #333', borderRadius: 8, padding: 40, textAlign: 'center' }}>
          <p className="text-[#666] text-sm">No sign-off sections found for this date/attraction.</p>
        </div>
      )}

      {/* Per-attraction breakdown */}
      {!loadingHistory && attractionIds.map((attrId) => {
        const attraction = attractionMap.get(attrId);
        const attrSections = allSections.filter((s) => s.attraction_id === attrId);
        const openingSections = attrSections.filter((s) => s.phase === 'opening');
        const closingSections = attrSections.filter((s) => s.phase === 'closing');

        const renderPhase = (phaseSections: SignoffSection[], phaseLabel: string) => {
          if (phaseSections.length === 0) return null;
          return (
            <div className="mb-3 last:mb-0">
              <div className="text-[#888] text-[11px] uppercase tracking-wider font-medium mb-2">{phaseLabel}</div>
              {phaseSections.map((section) => {
                const completion = completionMap.get(section.id);
                const isCompleted = !!completion;
                return (
                  <div key={section.id} className="flex items-center gap-3 py-2.5 border-b border-[#222] last:border-0">
                    {/* Status icon */}
                    {isCompleted ? (
                      <div className="w-6 h-6 rounded-full bg-[#1a4a1a] flex items-center justify-center shrink-0">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#4caf50" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-[#444] shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${isCompleted ? 'text-[#4caf50]' : 'text-white'}`}>
                          {section.name}
                        </span>
                        <span className="inline-block px-1.5 py-0.5 bg-[#1a2a3a] text-[#6ea8fe] text-[10px] font-medium rounded">
                          {SIGNOFF_ROLE_LABELS[section.role_key as SignoffRoleKey] || section.role_key}
                        </span>
                      </div>
                      {isCompleted && completion && (
                        <div className="text-[#888] text-xs mt-0.5">
                          Signed by <span className="text-[#ccc]">{completion.signed_by_name}</span>
                          {' '}({completion.signed_by_email})
                          {' '}&middot;{' '}
                          {new Date(completion.signed_at).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </div>
                      )}
                      {!isCompleted && (
                        <div className="text-[#f0ad4e] text-xs mt-0.5">Waiting for sign-off</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        };

        const attrCompleted = attrSections.filter((s) => completionMap.has(s.id)).length;
        const attrTotal = attrSections.length;

        return (
          <div key={attrId} style={{ background: '#111', border: '1px solid #333', borderRadius: 8, padding: 20, marginBottom: 16 }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white text-base font-semibold">{attraction?.name || 'Unknown'}</h3>
              {attrTotal > 0 && (
                attrCompleted === attrTotal ? (
                  <span className="inline-block text-[10px] font-semibold px-2 py-1 rounded bg-[#0a3d1f] text-[#4caf50]">
                    ALL SIGNED OFF
                  </span>
                ) : (
                  <span className="inline-block text-[10px] font-semibold px-2 py-1 rounded bg-[#3d3000] text-[#f0ad4e]">
                    {attrCompleted}/{attrTotal}
                  </span>
                )
              )}
            </div>
            {renderPhase(openingSections, 'Opening')}
            {renderPhase(closingSections, 'Closing')}
          </div>
        );
      })}
    </>
  );
}

/* ────────────────────────────────────────────────────────── */
/* ── Main Page                                             ── */
/* ────────────────────────────────────────────────────────── */
export default function SignoffConfigPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('config');

  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [selectedAttractionId, setSelectedAttractionId] = useState<string>('');

  const [sections, setSections] = useState<SignoffSection[]>([]);
  const [items, setItems] = useState<SignoffChecklistItem[]>([]);

  // Add section form
  const [addingSectionPhase, setAddingSectionPhase] = useState<Phase | null>(null);
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionRole, setNewSectionRole] = useState<SignoffRoleKey>('supervisor');

  // Add item form
  const [addingItemSectionId, setAddingItemSectionId] = useState<string | null>(null);
  const [newItemLabel, setNewItemLabel] = useState('');

  // Editing item
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemLabel, setEditingItemLabel] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'section' | 'item'; id: string; name: string } | null>(null);

  // Copy from modal
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copySourceId, setCopySourceId] = useState('');
  const [copying, setCopying] = useState(false);

  const fetchSections = useCallback(async (attractionId: string) => {
    if (!attractionId) {
      setSections([]);
      setItems([]);
      return;
    }

    const { data: secs } = await supabase
      .from('signoff_sections')
      .select('*')
      .eq('attraction_id', attractionId)
      .order('sort_order', { ascending: true });

    const sectionList: SignoffSection[] = secs || [];
    setSections(sectionList);

    if (sectionList.length > 0) {
      const sectionIds = sectionList.map((s) => s.id);
      const { data: itms } = await supabase
        .from('signoff_checklist_items')
        .select('*')
        .in('section_id', sectionIds)
        .order('sort_order', { ascending: true });
      setItems(itms || []);
    } else {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    async function init() {
      const auth = await checkAuth();
      if (!auth.authenticated || auth.role !== 'admin') {
        router.push('/login');
        return;
      }
      setUserEmail(auth.email || '');
      setDisplayName(auth.displayName || '');

      const { data: attractionsData } = await supabase
        .from('attractions')
        .select('*')
        .order('sort_order', { ascending: true });

      if (attractionsData) {
        setAttractions(attractionsData);
        if (attractionsData.length > 0) {
          setSelectedAttractionId(attractionsData[0].id);
        }
      }

      setLoading(false);
    }
    init();
  }, [router]);

  useEffect(() => {
    if (selectedAttractionId) {
      fetchSections(selectedAttractionId);
    }
  }, [selectedAttractionId, fetchSections]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  // ── Add section ──
  async function handleAddSection() {
    if (!addingSectionPhase || !newSectionName.trim() || !selectedAttractionId) return;

    const phaseSections = sections.filter((s) => s.phase === addingSectionPhase);
    const maxOrder = phaseSections.length > 0 ? Math.max(...phaseSections.map((s) => s.sort_order)) : -1;

    await supabase.from('signoff_sections').insert({
      attraction_id: selectedAttractionId,
      name: newSectionName.trim(),
      role_key: newSectionRole,
      phase: addingSectionPhase,
      sort_order: maxOrder + 1,
    });

    setAddingSectionPhase(null);
    setNewSectionName('');
    setNewSectionRole('supervisor');
    await fetchSections(selectedAttractionId);
  }

  // ── Delete section or item ──
  async function handleDelete() {
    if (!deleteTarget) return;

    if (deleteTarget.type === 'section') {
      await supabase.from('signoff_checklist_items').delete().eq('section_id', deleteTarget.id);
      await supabase.from('signoff_sections').delete().eq('id', deleteTarget.id);
    } else {
      await supabase.from('signoff_checklist_items').delete().eq('id', deleteTarget.id);
    }

    setDeleteTarget(null);
    await fetchSections(selectedAttractionId);
  }

  // ── Add checklist item ──
  async function handleAddItem() {
    if (!addingItemSectionId || !newItemLabel.trim()) return;

    const sectionItems = items.filter((i) => i.section_id === addingItemSectionId);
    const maxOrder = sectionItems.length > 0 ? Math.max(...sectionItems.map((i) => i.sort_order)) : -1;

    await supabase.from('signoff_checklist_items').insert({
      section_id: addingItemSectionId,
      label: newItemLabel.trim(),
      sort_order: maxOrder + 1,
    });

    // Keep the input open for the next item — just clear the label
    setNewItemLabel('');
    await fetchSections(selectedAttractionId);
  }

  // ── Edit checklist item ──
  async function handleSaveItemEdit() {
    if (!editingItemId || !editingItemLabel.trim()) return;

    await supabase
      .from('signoff_checklist_items')
      .update({ label: editingItemLabel.trim() })
      .eq('id', editingItemId);

    setEditingItemId(null);
    setEditingItemLabel('');
    await fetchSections(selectedAttractionId);
  }

  // ── Copy from another attraction ──
  async function handleCopy() {
    if (!copySourceId || !selectedAttractionId || copySourceId === selectedAttractionId) return;
    setCopying(true);

    const { data: sourceSections } = await supabase
      .from('signoff_sections')
      .select('*')
      .eq('attraction_id', copySourceId)
      .order('sort_order', { ascending: true });

    if (!sourceSections || sourceSections.length === 0) {
      setCopying(false);
      setShowCopyModal(false);
      return;
    }

    const sourceIds = sourceSections.map((s: SignoffSection) => s.id);
    const { data: sourceItems } = await supabase
      .from('signoff_checklist_items')
      .select('*')
      .in('section_id', sourceIds)
      .order('sort_order', { ascending: true });

    const existingIds = sections.map((s) => s.id);
    if (existingIds.length > 0) {
      await supabase.from('signoff_checklist_items').delete().in('section_id', existingIds);
      await supabase.from('signoff_sections').delete().eq('attraction_id', selectedAttractionId);
    }

    for (const sec of sourceSections) {
      const { data: newSec } = await supabase
        .from('signoff_sections')
        .insert({
          attraction_id: selectedAttractionId,
          name: sec.name,
          role_key: sec.role_key,
          phase: sec.phase,
          sort_order: sec.sort_order,
        })
        .select()
        .single();

      if (newSec && sourceItems) {
        const secItems = sourceItems.filter((i: SignoffChecklistItem) => i.section_id === sec.id);
        if (secItems.length > 0) {
          await supabase.from('signoff_checklist_items').insert(
            secItems.map((i: SignoffChecklistItem) => ({
              section_id: newSec.id,
              label: i.label,
              sort_order: i.sort_order,
            }))
          );
        }
      }
    }

    setCopying(false);
    setShowCopyModal(false);
    await fetchSections(selectedAttractionId);
  }

  function getItemsForSection(sectionId: string): SignoffChecklistItem[] {
    return items.filter((i) => i.section_id === sectionId);
  }

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
      <AdminNav userEmail={userEmail} displayName={displayName} onLogout={handleLogout} />

      <ConfirmModal
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.name}"?`}
        message={deleteTarget?.type === 'section'
          ? 'This will also remove all checklist items in this section. This cannot be undone.'
          : 'This checklist item will be permanently removed.'}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Copy from modal */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="bg-[#1a1a1a] border border-[#444] rounded-lg p-6 w-full max-w-[400px]">
            <p className="text-white text-sm font-semibold mb-4">Copy Sections From Another Attraction</p>
            <p className="text-[#888] text-[13px] mb-4">
              This will replace all existing sections and checklist items for <strong className="text-white">{selectedAttraction?.name}</strong>.
            </p>
            <select
              value={copySourceId}
              onChange={(e) => setCopySourceId(e.target.value)}
              className="w-full px-3 py-2.5 bg-[#111] border border-[#444] rounded-md text-[#e0e0e0] text-sm mb-4
                         focus:outline-none focus:border-[#6ea8fe] transition-colors"
            >
              <option value="">Select an attraction...</option>
              {attractions
                .filter((a) => a.id !== selectedAttractionId)
                .map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
            </select>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowCopyModal(false); setCopySourceId(''); }}
                className="flex-1 px-5 py-2.5 bg-transparent border border-[#555] text-[#ccc] hover:border-[#888] hover:text-white
                           rounded-md text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCopy}
                disabled={!copySourceId || copying}
                className="flex-1 px-5 py-2.5 bg-white text-black text-sm font-semibold rounded-md
                           hover:bg-[#ddd] transition-colors disabled:opacity-50"
              >
                {copying ? 'Copying...' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 20px' }}>
        <h2 style={{ color: '#fff', fontSize: 24, fontWeight: 700, marginBottom: 20 }}>Sign-Off</h2>

        {/* Tab bar */}
        <div className="flex gap-2 mb-5">
          {([
            { key: 'config' as AdminTab, label: 'Configuration' },
            { key: 'history' as AdminTab, label: 'History & Status' },
          ]).map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors border ${
                  isActive
                    ? 'bg-[#222] border-[#555] text-white'
                    : 'bg-transparent border-[#333] text-[#888] hover:border-[#555] hover:text-[#ccc]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── History Tab ── */}
        {activeTab === 'history' && (
          <SignoffHistoryTab attractions={attractions} />
        )}

        {/* ── Config Tab ── */}
        {activeTab === 'config' && (
          <>
            {/* Attraction selector */}
            <div style={{ background: '#111', border: '1px solid #333', borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <label className="text-[#ccc] text-sm font-medium shrink-0">Attraction:</label>
                <select
                  value={selectedAttractionId}
                  onChange={(e) => setSelectedAttractionId(e.target.value)}
                  className="flex-1 px-3 py-2.5 bg-[#1a1a1a] border border-[#444] rounded-md text-[#e0e0e0] text-sm
                             focus:outline-none focus:border-[#6ea8fe] transition-colors"
                >
                  {attractions.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowCopyModal(true)}
                  className="px-4 py-2.5 bg-transparent border border-[#555] text-[#ccc] text-sm font-medium rounded-md
                             hover:border-[#888] hover:text-white transition-colors shrink-0"
                >
                  Copy from...
                </button>
              </div>
            </div>

            {/* Phase cards */}
            {PHASES.map((phase) => {
              const phaseSections = sections.filter((s) => s.phase === phase);

              return (
                <div key={phase} style={{ background: '#111', border: '1px solid #333', borderRadius: 8, padding: 20, marginBottom: 20 }}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white text-base font-semibold capitalize">{phase} Sections</h3>
                    <button
                      onClick={() => {
                        setAddingSectionPhase(phase);
                        setNewSectionName('');
                        setNewSectionRole('supervisor');
                      }}
                      className="px-3 py-1.5 bg-white text-black text-xs font-semibold rounded-md hover:bg-[#ddd] transition-colors"
                    >
                      + Add Section
                    </button>
                  </div>

                  {/* Add section inline form */}
                  {addingSectionPhase === phase && (
                    <div className="bg-[#1a1a1a] border border-[#444] rounded-md p-4 mb-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-[#ccc] text-[12px] font-medium mb-1">Section Name</label>
                          <input
                            type="text"
                            value={newSectionName}
                            onChange={(e) => setNewSectionName(e.target.value)}
                            placeholder="e.g. Attraction Supervisor"
                            autoFocus
                            className="w-full px-3 py-2 bg-[#111] border border-[#444] rounded-md text-[#e0e0e0] text-sm
                                       placeholder-[#666] focus:outline-none focus:border-[#6ea8fe] transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-[#ccc] text-[12px] font-medium mb-1">Required Role</label>
                          <select
                            value={newSectionRole}
                            onChange={(e) => setNewSectionRole(e.target.value as SignoffRoleKey)}
                            className="w-full px-3 py-2 bg-[#111] border border-[#444] rounded-md text-[#e0e0e0] text-sm
                                       focus:outline-none focus:border-[#6ea8fe] transition-colors"
                          >
                            {ALL_SIGNOFF_ROLES.map((r) => (
                              <option key={r} value={r}>{SIGNOFF_ROLE_LABELS[r]}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleAddSection}
                          disabled={!newSectionName.trim()}
                          className="px-4 py-2 bg-white text-black text-xs font-semibold rounded-md hover:bg-[#ddd] transition-colors disabled:opacity-50"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => setAddingSectionPhase(null)}
                          className="px-4 py-2 bg-transparent border border-[#555] text-[#ccc] text-xs font-medium rounded-md
                                     hover:border-[#888] hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {phaseSections.length === 0 && addingSectionPhase !== phase && (
                    <p className="text-[#666] text-sm">No {phase} sections configured. Click &quot;+ Add Section&quot; to create one.</p>
                  )}

                  {/* Sections list */}
                  {phaseSections.map((section) => {
                    const sectionItems = getItemsForSection(section.id);

                    return (
                      <div key={section.id} className="border border-[#333] rounded-md mb-3 overflow-hidden">
                        {/* Section header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-[#1a1a1a]">
                          <div className="flex items-center gap-3">
                            <span className="text-[#e0e0e0] text-sm font-medium">{section.name}</span>
                            <span className="inline-block px-2 py-0.5 bg-[#1a2a3a] text-[#6ea8fe] text-[10px] font-medium rounded">
                              {SIGNOFF_ROLE_LABELS[section.role_key as SignoffRoleKey] || section.role_key}
                            </span>
                          </div>
                          <button
                            onClick={() => setDeleteTarget({ type: 'section', id: section.id, name: section.name })}
                            className="px-2 py-1 text-[#888] text-xs hover:text-[#d43518] transition-colors"
                          >
                            Remove
                          </button>
                        </div>

                        {/* Checklist items */}
                        <div className="px-4 py-2">
                          {sectionItems.length === 0 && (
                            <p className="text-[#666] text-xs py-1">No checklist items yet.</p>
                          )}

                          {sectionItems.map((item, idx) => (
                            <div key={item.id} className="flex items-center gap-2 py-1.5 border-b border-[#222] last:border-0">
                              <span className="text-[#666] text-xs w-5 text-right shrink-0">{idx + 1}.</span>

                              {editingItemId === item.id ? (
                                <div className="flex-1 flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editingItemLabel}
                                    onChange={(e) => setEditingItemLabel(e.target.value)}
                                    autoFocus
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveItemEdit(); if (e.key === 'Escape') setEditingItemId(null); }}
                                    className="flex-1 px-2 py-1 bg-[#111] border border-[#444] rounded text-[#e0e0e0] text-sm
                                               focus:outline-none focus:border-[#6ea8fe] transition-colors"
                                  />
                                  <button onClick={handleSaveItemEdit} className="text-[#4caf50] text-xs font-medium hover:text-[#66bb6a]">Save</button>
                                  <button onClick={() => setEditingItemId(null)} className="text-[#888] text-xs hover:text-white">Cancel</button>
                                </div>
                              ) : (
                                <>
                                  <span className="flex-1 text-[#ccc] text-sm">{item.label}</span>
                                  <button
                                    onClick={() => { setEditingItemId(item.id); setEditingItemLabel(item.label); }}
                                    className="text-[#888] text-xs hover:text-white transition-colors"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => setDeleteTarget({ type: 'item', id: item.id, name: item.label })}
                                    className="text-[#888] text-xs hover:text-[#d43518] transition-colors"
                                  >
                                    Remove
                                  </button>
                                </>
                              )}
                            </div>
                          ))}

                          {/* Add item inline */}
                          {addingItemSectionId === section.id ? (
                            <div className="flex items-center gap-2 py-2">
                              <input
                                type="text"
                                value={newItemLabel}
                                onChange={(e) => setNewItemLabel(e.target.value)}
                                placeholder="Checklist item label..."
                                autoFocus
                                onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(); if (e.key === 'Escape') setAddingItemSectionId(null); }}
                                className="flex-1 px-2 py-1.5 bg-[#111] border border-[#444] rounded text-[#e0e0e0] text-sm
                                           placeholder-[#666] focus:outline-none focus:border-[#6ea8fe] transition-colors"
                              />
                              <button onClick={handleAddItem} disabled={!newItemLabel.trim()} className="text-[#4caf50] text-xs font-medium hover:text-[#66bb6a] disabled:opacity-50">Add</button>
                              <button onClick={() => setAddingItemSectionId(null)} className="text-[#888] text-xs hover:text-white">Cancel</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setAddingItemSectionId(section.id); setNewItemLabel(''); }}
                              className="text-[#6ea8fe] text-xs font-medium py-1.5 hover:text-[#8ec0ff] transition-colors"
                            >
                              + Add item
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </>
        )}

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Link href="/privacy" style={{ color: '#555', fontSize: 11, textDecoration: 'none' }}>
            Privacy Policy
          </Link>
        </div>
      </main>
    </div>
  );
}
