'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { checkAuth } from '@/lib/auth';
import AdminNav from '@/components/AdminNav';
import { ALL_SIGNOFF_ROLES, SIGNOFF_ROLE_LABELS, getTodayDateStr } from '@/lib/signoff';
import type { Attraction, SignoffSection, SignoffChecklistItem, SignoffCompletion, SignoffRoleKey } from '@/types/database';

/* ── Green check icon (reusable) ── */
function GreenCheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M3 7L6 10L11 4" stroke="#4caf50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Empty circle icon (reusable) ── */
function EmptyCircleIcon() {
  return <div className="w-5 h-5 rounded-full border-2 border-[#555] shrink-0" />;
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
      <div className="bg-[#111] border border-[#333] rounded-[8px] p-6 w-full max-w-[420px]">
        <p className="text-white text-sm font-semibold mb-1">{title}</p>
        <p className="text-[#888] text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-5 py-2.5 border border-[#555] text-[#ccc] hover:border-[#888] hover:text-white rounded-[6px] text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-5 py-2.5 bg-[#d43518] hover:bg-[#b52d14] text-white rounded-[6px] text-sm font-semibold transition-colors"
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
function SignoffHistoryTab({ attractions }: { attractions: Attraction[] }) {
  const [selectedDate, setSelectedDate] = useState(getTodayDateStr());
  const [selectedAttractionId, setSelectedAttractionId] = useState<string>('all');
  const [allSections, setAllSections] = useState<SignoffSection[]>([]);
  const [completions, setCompletions] = useState<SignoffCompletion[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const attractionMap = new Map(attractions.map((a) => [a.id, a]));

  const fetchHistory = useCallback(async (date: string, attractionId: string) => {
    setLoadingHistory(true);
    let sectionsQuery = supabase.from('signoff_sections').select('*').order('sort_order', { ascending: true });
    if (attractionId !== 'all') sectionsQuery = sectionsQuery.eq('attraction_id', attractionId);
    const { data: secs } = await sectionsQuery;

    let completionsQuery = supabase.from('signoff_completions').select('*').eq('sign_date', date);
    if (attractionId !== 'all') completionsQuery = completionsQuery.eq('attraction_id', attractionId);
    const { data: comps } = await completionsQuery;

    setAllSections(secs || []);
    setCompletions(comps || []);
    setLoadingHistory(false);
  }, []);

  useEffect(() => { fetchHistory(selectedDate, selectedAttractionId); }, [selectedDate, selectedAttractionId, fetchHistory]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-signoff-history')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'signoff_completions' }, () => { fetchHistory(selectedDate, selectedAttractionId); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedDate, selectedAttractionId, fetchHistory]);

  const isToday = selectedDate === getTodayDateStr();
  const completionMap = new Map<string, SignoffCompletion>();
  for (const c of completions) completionMap.set(c.section_id, c);

  const attractionIds = [...new Set(allSections.map((s) => s.attraction_id))];
  attractionIds.sort((a, b) => {
    const aa = attractionMap.get(a);
    const bb = attractionMap.get(b);
    return (aa?.sort_order || 0) - (bb?.sort_order || 0);
  });

  const totalSections = allSections.length;
  const completedSections = allSections.filter((s) => completionMap.has(s.id)).length;
  const waitingSections = totalSections - completedSections;

  return (
    <>
      <div className="bg-[#111] border border-[#333] rounded-[8px] p-10 mb-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <label className="text-[#ccc] text-[13px] font-medium shrink-0">Date</label>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="px-3 py-2.5 bg-[#1a1a1a] border border-[#444] rounded-[6px] text-[#e0e0e0] text-sm focus:outline-none focus:border-[#6ea8fe] focus:shadow-[0_0_0_2px_rgba(110,168,254,0.2)] transition-colors" />
          {!isToday && (<button onClick={() => setSelectedDate(getTodayDateStr())} className="px-3 py-2 border border-[#555] text-[#ccc] text-xs font-medium rounded-[6px] hover:border-[#888] hover:text-white transition-colors">Today</button>)}
          <div className="w-px h-6 bg-[#333] hidden sm:block" />
          <label className="text-[#ccc] text-[13px] font-medium shrink-0">Attraction</label>
          <select value={selectedAttractionId} onChange={(e) => setSelectedAttractionId(e.target.value)} className="flex-1 px-3 py-2.5 bg-[#1a1a1a] border border-[#444] rounded-[6px] text-[#e0e0e0] text-sm focus:outline-none focus:border-[#6ea8fe] focus:shadow-[0_0_0_2px_rgba(110,168,254,0.2)] transition-colors">
            <option value="all">All Attractions</option>
            {attractions.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
          </select>
        </div>
      </div>

      <div className="bg-[#111] border border-[#333] rounded-[8px] p-10 mb-10">
        <div className="flex items-center gap-12 flex-wrap">
          <div><span className="text-[#888] text-xs uppercase tracking-wider block mb-1">Total</span><div className="text-white text-2xl font-bold">{totalSections}</div></div>
          <div><span className="text-[#888] text-xs uppercase tracking-wider block mb-1">Completed</span><div className="text-[#4caf50] text-2xl font-bold">{completedSections}</div></div>
          <div><span className="text-[#888] text-xs uppercase tracking-wider block mb-1">Waiting</span><div className={`text-2xl font-bold ${waitingSections > 0 ? 'text-[#ffc107]' : 'text-[#4caf50]'}`}>{waitingSections}</div></div>
          {totalSections > 0 && (<div className="flex-1 min-w-[120px]"><div className="w-full h-2 bg-[#222] rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${(completedSections / totalSections) * 100}%`, background: '#4caf50' }} /></div></div>)}
        </div>
      </div>

      {loadingHistory && <div className="text-[#888] text-sm text-center py-8">Loading...</div>}
      {!loadingHistory && totalSections === 0 && (<div className="bg-[#111] border border-[#333] rounded-[8px] p-10 text-center"><p className="text-[#666] text-sm">No sign-off sections found for this date/attraction.</p></div>)}

      {!loadingHistory && attractionIds.map((attrId, attrIndex) => {
        const attraction = attractionMap.get(attrId);
        const attrSections = allSections.filter((s) => s.attraction_id === attrId);
        const openingSections = attrSections.filter((s) => s.phase === 'opening');
        const closingSections = attrSections.filter((s) => s.phase === 'closing');

        const renderPhase = (phaseSections: SignoffSection[], phaseLabel: string) => {
          if (phaseSections.length === 0) return null;
          return (
            <div className="mb-6 last:mb-0">
              <div className="text-[#888] text-[11px] uppercase tracking-wider font-medium mb-6">{phaseLabel}</div>
              <div className="space-y-4">
                {phaseSections.map((section) => {
                  const completion = completionMap.get(section.id);
                  const isCompleted = !!completion;
                  return (
                    <div key={section.id} className="bg-[#1a1a1a] border border-[#333] rounded-[6px] px-7 py-6 flex items-center gap-5">
                      {isCompleted ? (<div className="w-6 h-6 rounded-full bg-[#0a3d1f] flex items-center justify-center shrink-0"><GreenCheckIcon size={13} /></div>) : (<EmptyCircleIcon />)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${isCompleted ? 'text-[#4caf50]' : 'text-[#e0e0e0]'}`}>{section.name}</span>
                          <span className="inline-block px-1.5 py-0.5 bg-[#0d2f5e] text-[#6ea8fe] text-[10px] font-medium rounded-[12px]">{SIGNOFF_ROLE_LABELS[section.role_key as SignoffRoleKey] || section.role_key}</span>
                        </div>
                        {isCompleted && completion && (<div className="text-[#888] text-xs mt-1">Signed by <span className="text-[#e0e0e0]">{completion.signed_by_name}</span>{' '}({completion.signed_by_email}){' '}&middot;{' '}{new Date(completion.signed_at).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })}</div>)}
                        {!isCompleted && (<div className="text-[#ffc107] text-xs mt-1">Waiting for sign-off</div>)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        };

        const attrCompleted = attrSections.filter((s) => completionMap.has(s.id)).length;
        const attrTotal = attrSections.length;

        return (
          <fieldset key={attrId} className="border border-[#333] rounded-[16px] p-8 sm:p-10 mb-10 bg-[#111]">
            <legend className="text-base font-semibold text-white px-4 flex items-center gap-4">
              <span className="inline-flex items-center justify-center w-9 h-9 bg-white text-black rounded-full text-sm font-bold">{attrIndex + 1}</span>
              {attraction?.name || 'Unknown'}
              {attrTotal > 0 && (attrCompleted === attrTotal ? (<span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-[12px] bg-[#0a3d1f] text-[#4caf50]"><GreenCheckIcon size={11} />ALL SIGNED OFF</span>) : (<span className="inline-block text-[11px] font-semibold px-2.5 py-1 rounded-[12px] bg-[#3d3000] text-[#ffc107]">{attrCompleted}/{attrTotal}</span>))}
            </legend>
            {renderPhase(openingSections, 'Opening')}
            {renderPhase(closingSections, 'Closing')}
          </fieldset>
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
  const [activeTab, setActiveTab] = useState<AdminTab>('history');
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [selectedAttractionId, setSelectedAttractionId] = useState<string>('');
  const [sections, setSections] = useState<SignoffSection[]>([]);
  const [items, setItems] = useState<SignoffChecklistItem[]>([]);
  const [addingSectionPhase, setAddingSectionPhase] = useState<Phase | null>(null);
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionRole, setNewSectionRole] = useState<SignoffRoleKey>('supervisor');
  const [addingItemSectionId, setAddingItemSectionId] = useState<string | null>(null);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemLabel, setEditingItemLabel] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'section' | 'item'; id: string; name: string } | null>(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copySourceId, setCopySourceId] = useState('');
  const [copying, setCopying] = useState(false);

  /* ── Section editing state ── */
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState('');
  const [editingSectionRole, setEditingSectionRole] = useState<SignoffRoleKey>('supervisor');

  const fetchSections = useCallback(async (attractionId: string) => {
    if (!attractionId) { setSections([]); setItems([]); return; }
    const { data: secs } = await supabase.from('signoff_sections').select('*').eq('attraction_id', attractionId).order('sort_order', { ascending: true });
    const sectionList: SignoffSection[] = secs || [];
    setSections(sectionList);
    if (sectionList.length > 0) {
      const sectionIds = sectionList.map((s) => s.id);
      const { data: itms } = await supabase.from('signoff_checklist_items').select('*').in('section_id', sectionIds).order('sort_order', { ascending: true });
      setItems(itms || []);
    } else { setItems([]); }
  }, []);

  useEffect(() => {
    async function init() {
      const auth = await checkAuth();
      if (!auth.authenticated || auth.role !== 'admin') { router.push('/login'); return; }
      setUserEmail(auth.email || '');
      setDisplayName(auth.displayName || '');
      const { data: attractionsData } = await supabase.from('attractions').select('*').order('sort_order', { ascending: true });
      if (attractionsData) { setAttractions(attractionsData); if (attractionsData.length > 0) setSelectedAttractionId(attractionsData[0].id); }
      setLoading(false);
    }
    init();
  }, [router]);

  useEffect(() => { if (selectedAttractionId) fetchSections(selectedAttractionId); }, [selectedAttractionId, fetchSections]);

  async function handleLogout() { await supabase.auth.signOut(); router.push('/login'); }

  async function handleAddSection() {
    if (!addingSectionPhase || !newSectionName.trim() || !selectedAttractionId) return;
    const phaseSections = sections.filter((s) => s.phase === addingSectionPhase);
    const maxOrder = phaseSections.length > 0 ? Math.max(...phaseSections.map((s) => s.sort_order)) : -1;
    await supabase.from('signoff_sections').insert({ attraction_id: selectedAttractionId, name: newSectionName.trim(), role_key: newSectionRole, phase: addingSectionPhase, sort_order: maxOrder + 1, requires_all_complete: false });
    setAddingSectionPhase(null); setNewSectionName(''); setNewSectionRole('supervisor');
    await fetchSections(selectedAttractionId);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'section') { await supabase.from('signoff_checklist_items').delete().eq('section_id', deleteTarget.id); await supabase.from('signoff_sections').delete().eq('id', deleteTarget.id); }
    else { await supabase.from('signoff_checklist_items').delete().eq('id', deleteTarget.id); }
    setDeleteTarget(null); await fetchSections(selectedAttractionId);
  }

  async function handleAddItem() {
    if (!addingItemSectionId || !newItemLabel.trim()) return;
    const sectionItems = items.filter((i) => i.section_id === addingItemSectionId);
    const maxOrder = sectionItems.length > 0 ? Math.max(...sectionItems.map((i) => i.sort_order)) : -1;
    await supabase.from('signoff_checklist_items').insert({ section_id: addingItemSectionId, label: newItemLabel.trim(), sort_order: maxOrder + 1 });
    setNewItemLabel(''); await fetchSections(selectedAttractionId);
  }

  async function handleSaveItemEdit() {
    if (!editingItemId || !editingItemLabel.trim()) return;
    await supabase.from('signoff_checklist_items').update({ label: editingItemLabel.trim() }).eq('id', editingItemId);
    setEditingItemId(null); setEditingItemLabel(''); await fetchSections(selectedAttractionId);
  }

  async function handleSaveSectionEdit() {
    if (!editingSectionId || !editingSectionName.trim()) return;
    await supabase.from('signoff_sections').update({ name: editingSectionName.trim(), role_key: editingSectionRole }).eq('id', editingSectionId);
    setEditingSectionId(null); setEditingSectionName(''); setEditingSectionRole('supervisor');
    await fetchSections(selectedAttractionId);
  }

  async function handleMoveSection(sectionId: string, direction: 'up' | 'down') {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    const phaseSections = sections.filter((s) => s.phase === section.phase);
    const idx = phaseSections.findIndex((s) => s.id === sectionId);
    if (direction === 'up' && idx <= 0) return;
    if (direction === 'down' && idx >= phaseSections.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const swapSection = phaseSections[swapIdx];
    await Promise.all([
      supabase.from('signoff_sections').update({ sort_order: swapSection.sort_order }).eq('id', section.id),
      supabase.from('signoff_sections').update({ sort_order: section.sort_order }).eq('id', swapSection.id),
    ]);
    await fetchSections(selectedAttractionId);
  }

  async function handleToggleRequiresAll(sectionId: string) {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    await supabase.from('signoff_sections').update({ requires_all_complete: !section.requires_all_complete }).eq('id', sectionId);
    await fetchSections(selectedAttractionId);
  }

  async function handleCopy() {
    if (!copySourceId || !selectedAttractionId || copySourceId === selectedAttractionId) return;
    setCopying(true);
    const { data: sourceSections } = await supabase.from('signoff_sections').select('*').eq('attraction_id', copySourceId).order('sort_order', { ascending: true });
    if (!sourceSections || sourceSections.length === 0) { setCopying(false); setShowCopyModal(false); return; }
    const sourceIds = sourceSections.map((s: SignoffSection) => s.id);
    const { data: sourceItems } = await supabase.from('signoff_checklist_items').select('*').in('section_id', sourceIds).order('sort_order', { ascending: true });
    const existingIds = sections.map((s) => s.id);
    if (existingIds.length > 0) { await supabase.from('signoff_checklist_items').delete().in('section_id', existingIds); await supabase.from('signoff_sections').delete().eq('attraction_id', selectedAttractionId); }
    for (const sec of sourceSections) {
      const { data: newSec } = await supabase.from('signoff_sections').insert({ attraction_id: selectedAttractionId, name: sec.name, role_key: sec.role_key, phase: sec.phase, sort_order: sec.sort_order }).select().single();
      if (newSec && sourceItems) {
        const secItems = sourceItems.filter((i: SignoffChecklistItem) => i.section_id === sec.id);
        if (secItems.length > 0) await supabase.from('signoff_checklist_items').insert(secItems.map((i: SignoffChecklistItem) => ({ section_id: newSec.id, label: i.label, sort_order: i.sort_order })));
      }
    }
    setCopying(false); setShowCopyModal(false); await fetchSections(selectedAttractionId);
  }

  function getItemsForSection(sectionId: string): SignoffChecklistItem[] { return items.filter((i) => i.section_id === sectionId); }

  const selectedAttraction = attractions.find((a) => a.id === selectedAttractionId);

  if (loading) return (<div className="flex h-screen items-center justify-center bg-black"><div className="text-[#888] text-sm">Loading...</div></div>);

  return (
    <div className="min-h-screen bg-black">
      <AdminNav userEmail={userEmail} displayName={displayName} onLogout={handleLogout} />
      <ConfirmModal open={!!deleteTarget} title={`Delete "${deleteTarget?.name}"?`} message={deleteTarget?.type === 'section' ? 'This will also remove all checklist items in this section. This cannot be undone.' : 'This checklist item will be permanently removed.'} confirmLabel="Delete" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />

      {showCopyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="bg-[#111] border border-[#333] rounded-[8px] p-10 w-full max-w-[420px]">
            <p className="text-white text-sm font-semibold mb-2">Copy Sections From Another Attraction</p>
            <p className="text-[#888] text-[13px] mb-8">This will replace all existing sections and checklist items for <strong className="text-[#e0e0e0]">{selectedAttraction?.name}</strong>.</p>
            <select value={copySourceId} onChange={(e) => setCopySourceId(e.target.value)} className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-[#444] rounded-[6px] text-[#e0e0e0] text-sm mb-8 focus:outline-none focus:border-[#6ea8fe] focus:shadow-[0_0_0_2px_rgba(110,168,254,0.2)] transition-colors">
              <option value="">Select an attraction...</option>
              {attractions.filter((a) => a.id !== selectedAttractionId).map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
            </select>
            <div className="flex gap-3">
              <button onClick={() => { setShowCopyModal(false); setCopySourceId(''); }} className="flex-1 px-5 py-2.5 border border-[#555] text-[#ccc] hover:border-[#888] hover:text-white rounded-[6px] text-sm font-semibold transition-colors">Cancel</button>
              <button onClick={handleCopy} disabled={!copySourceId || copying} className="flex-1 px-5 py-2.5 bg-white text-black text-sm font-semibold rounded-[6px] hover:bg-[#ddd] transition-colors disabled:opacity-50">{copying ? 'Copying...' : 'Copy'}</button>
            </div>
          </div>
        </div>
      )}

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 28px' }}>
        <h2 className="text-white text-2xl font-bold mb-10">Sign-Off</h2>

        <div className="flex border-b border-[#333]" style={{ marginBottom: 48 }}>
          {([{ key: 'history' as AdminTab, label: 'Status' }, { key: 'config' as AdminTab, label: 'Configuration' }]).map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative text-sm font-semibold transition-colors touch-manipulation
                  ${isActive ? 'text-white' : 'text-[#888] hover:text-white'}`}
                style={{ padding: '14px 24px' }}
              >
                {tab.label}
                {isActive && <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-white rounded-full" />}
              </button>
            );
          })}
        </div>

        {activeTab === 'history' && <SignoffHistoryTab attractions={attractions} />}

        {activeTab === 'config' && (
          <>
            <div className="bg-[#111] border border-[#333] rounded-[8px] p-10 mb-10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <label className="text-[#ccc] text-[13px] font-medium shrink-0">Attraction</label>
                <select value={selectedAttractionId} onChange={(e) => setSelectedAttractionId(e.target.value)} className="flex-1 px-3 py-2.5 bg-[#1a1a1a] border border-[#444] rounded-[6px] text-[#e0e0e0] text-sm focus:outline-none focus:border-[#6ea8fe] focus:shadow-[0_0_0_2px_rgba(110,168,254,0.2)] transition-colors">
                  {attractions.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                </select>
                <button onClick={() => setShowCopyModal(true)} className="px-4 py-2.5 border border-[#555] text-[#ccc] text-sm font-medium rounded-[6px] hover:border-[#888] hover:text-white transition-colors shrink-0">Copy from...</button>
              </div>
            </div>

            {PHASES.map((phase, phaseIndex) => {
              const phaseSections = sections.filter((s) => s.phase === phase);
              return (
                <fieldset key={phase} className="border border-[#333] rounded-[16px] p-8 sm:p-10 bg-[#111]" style={{ marginBottom: 48 }}>
                  <legend className="text-base font-semibold text-white px-4 flex items-center gap-4">
                    <span className="inline-flex items-center justify-center w-9 h-9 bg-white text-black rounded-full text-sm font-bold">{phaseIndex + 1}</span>
                    {`${phase.charAt(0).toUpperCase() + phase.slice(1)} Sections`}
                    <button onClick={() => { setAddingSectionPhase(phase); setNewSectionName(''); setNewSectionRole('supervisor'); }} className="px-4 py-2 bg-white text-black text-xs font-semibold rounded-[6px] hover:bg-[#ddd] transition-colors ml-auto">+ Add Section</button>
                  </legend>

                  {addingSectionPhase === phase && (
                    <div className="bg-[#1a1a1a] border border-[#333] rounded-[6px] p-8 mb-8">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                        <div>
                          <label className="block text-[#ccc] text-[13px] font-medium mb-1.5">Section Name</label>
                          <input type="text" value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)} placeholder="e.g. Attraction Supervisor" autoFocus className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-[#444] rounded-[6px] text-[#e0e0e0] text-sm placeholder-[#666] focus:outline-none focus:border-[#6ea8fe] focus:shadow-[0_0_0_2px_rgba(110,168,254,0.2)] transition-colors" />
                        </div>
                        <div>
                          <label className="block text-[#ccc] text-[13px] font-medium mb-1.5">Required Role</label>
                          <select value={newSectionRole} onChange={(e) => setNewSectionRole(e.target.value as SignoffRoleKey)} className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-[#444] rounded-[6px] text-[#e0e0e0] text-sm focus:outline-none focus:border-[#6ea8fe] focus:shadow-[0_0_0_2px_rgba(110,168,254,0.2)] transition-colors">
                            {ALL_SIGNOFF_ROLES.map((r) => (<option key={r} value={r}>{SIGNOFF_ROLE_LABELS[r]}</option>))}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={handleAddSection} disabled={!newSectionName.trim()} className="px-5 py-2 bg-white text-black text-xs font-semibold rounded-[6px] hover:bg-[#ddd] transition-colors disabled:opacity-50">Add</button>
                        <button onClick={() => setAddingSectionPhase(null)} className="px-5 py-2 border border-[#555] text-[#ccc] text-xs font-medium rounded-[6px] hover:border-[#888] hover:text-white transition-colors">Cancel</button>
                      </div>
                    </div>
                  )}

                  {phaseSections.length === 0 && addingSectionPhase !== phase && (<p className="text-[#666] text-sm">No {phase} sections configured. Click &quot;+ Add Section&quot; to create one.</p>)}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {phaseSections.map((section, sectionIdx) => {
                      const sectionItems = getItemsForSection(section.id);
                      return (
                        <div key={section.id} className="bg-[#1a1a1a] border border-[#333] rounded-[6px] overflow-hidden">
                          <div className="flex items-center justify-between px-7 py-5 border-b border-[#333]">
                            {editingSectionId === section.id ? (
                              <div className="flex-1 flex items-center gap-3 flex-wrap">
                                <input type="text" value={editingSectionName} onChange={(e) => setEditingSectionName(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleSaveSectionEdit(); if (e.key === 'Escape') setEditingSectionId(null); }} className="flex-1 min-w-[140px] px-3 py-1.5 bg-[#1a1a1a] border border-[#444] rounded-[6px] text-[#e0e0e0] text-sm focus:outline-none focus:border-[#6ea8fe] focus:shadow-[0_0_0_2px_rgba(110,168,254,0.2)] transition-colors" />
                                <select value={editingSectionRole} onChange={(e) => setEditingSectionRole(e.target.value as SignoffRoleKey)} className="px-3 py-1.5 bg-[#1a1a1a] border border-[#444] rounded-[6px] text-[#e0e0e0] text-sm focus:outline-none focus:border-[#6ea8fe] focus:shadow-[0_0_0_2px_rgba(110,168,254,0.2)] transition-colors">
                                  {ALL_SIGNOFF_ROLES.map((r) => (<option key={r} value={r}>{SIGNOFF_ROLE_LABELS[r]}</option>))}
                                </select>
                                <button onClick={handleSaveSectionEdit} className="text-[#4caf50] text-xs font-medium hover:text-[#66bb6a]">Save</button>
                                <button onClick={() => setEditingSectionId(null)} className="text-[#888] text-xs hover:text-white">Cancel</button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-3 flex-wrap">
                                  <span className="w-6 h-6 rounded-full bg-white text-black text-[11px] font-bold flex items-center justify-center shrink-0">{sectionIdx + 1}</span>
                                  <span className="text-[#e0e0e0] text-sm font-medium">{section.name}</span>
                                  <span className="inline-block px-2 py-0.5 bg-[#0d2f5e] text-[#6ea8fe] text-[10px] font-medium rounded-[12px]">{SIGNOFF_ROLE_LABELS[section.role_key as SignoffRoleKey] || section.role_key}</span>
                                  {section.requires_all_complete && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#3d3000] text-[#ffc107] text-[10px] font-medium rounded-[12px]">
                                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><rect x="2" y="5.5" width="8" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M4 5.5V3.5C4 2.4 4.9 1.5 6 1.5C7.1 1.5 8 2.4 8 3.5V5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/></svg>
                                      Requires all checks
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleToggleRequiresAll(section.id)}
                                    className={`px-2 py-1 text-xs font-medium transition-colors ${section.requires_all_complete ? 'text-[#ffc107] hover:text-[#ffca28]' : 'text-[#888] hover:text-white'}`}
                                    title={section.requires_all_complete ? 'Remove lock (currently requires all other checks)' : 'Lock until all other checks are complete'}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                                      <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="none"/>
                                      {section.requires_all_complete
                                        ? <path d="M5 7V5C5 3.34 6.34 2 8 2C9.66 2 11 3.34 11 5V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
                                        : <path d="M5 7V5C5 3.34 6.34 2 8 2C9.66 2 11 3.34 11 5V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
                                      }
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleMoveSection(section.id, 'up')}
                                    disabled={sectionIdx === 0}
                                    className="px-1.5 py-1 text-[#888] text-xs hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Move up"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 10V4M7 4L4 7M7 4L10 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                  </button>
                                  <button
                                    onClick={() => handleMoveSection(section.id, 'down')}
                                    disabled={sectionIdx === phaseSections.length - 1}
                                    className="px-1.5 py-1 text-[#888] text-xs hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Move down"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 4V10M7 10L4 7M7 10L10 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                  </button>
                                  <button onClick={() => { setEditingSectionId(section.id); setEditingSectionName(section.name); setEditingSectionRole(section.role_key as SignoffRoleKey); }} className="px-2 py-1 text-[#888] text-xs hover:text-white transition-colors">Edit</button>
                                  <button onClick={() => setDeleteTarget({ type: 'section', id: section.id, name: section.name })} className="px-2 py-1 text-[#888] text-xs hover:text-[#d43518] transition-colors">Remove</button>
                                </div>
                              </>
                            )}
                          </div>

                          <div className="px-7 pb-7 pt-4" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {sectionItems.length === 0 && (<p className="text-[#666] text-xs py-1">No checklist items yet.</p>)}
                            {sectionItems.map((item) => (
                              <div key={item.id} className="bg-[#111] border border-[#333] rounded-[8px] px-6 py-5 flex items-center gap-4">
                                <div className="w-5 h-5 rounded-full bg-[#0a3d1f] flex items-center justify-center shrink-0"><GreenCheckIcon size={11} /></div>
                                {editingItemId === item.id ? (
                                  <div className="flex-1 flex items-center gap-2">
                                    <input type="text" value={editingItemLabel} onChange={(e) => setEditingItemLabel(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleSaveItemEdit(); if (e.key === 'Escape') setEditingItemId(null); }} className="flex-1 px-3 py-1.5 bg-[#1a1a1a] border border-[#444] rounded-[6px] text-[#e0e0e0] text-sm focus:outline-none focus:border-[#6ea8fe] focus:shadow-[0_0_0_2px_rgba(110,168,254,0.2)] transition-colors" />
                                    <button onClick={handleSaveItemEdit} className="text-[#4caf50] text-xs font-medium hover:text-[#66bb6a]">Save</button>
                                    <button onClick={() => setEditingItemId(null)} className="text-[#888] text-xs hover:text-white">Cancel</button>
                                  </div>
                                ) : (
                                  <>
                                    <span className="flex-1 text-[#e0e0e0] text-sm">{item.label}</span>
                                    <button onClick={() => { setEditingItemId(item.id); setEditingItemLabel(item.label); }} className="text-[#888] text-xs hover:text-white transition-colors">Edit</button>
                                    <button onClick={() => setDeleteTarget({ type: 'item', id: item.id, name: item.label })} className="text-[#888] text-xs hover:text-[#d43518] transition-colors">Remove</button>
                                  </>
                                )}
                              </div>
                            ))}

                            {addingItemSectionId === section.id ? (
                              <div className="flex items-center gap-3 pt-2">
                                <input type="text" value={newItemLabel} onChange={(e) => setNewItemLabel(e.target.value)} placeholder="Checklist item label..." autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(); if (e.key === 'Escape') setAddingItemSectionId(null); }} className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-[#444] rounded-[6px] text-[#e0e0e0] text-sm placeholder-[#666] focus:outline-none focus:border-[#6ea8fe] focus:shadow-[0_0_0_2px_rgba(110,168,254,0.2)] transition-colors" />
                                <button onClick={handleAddItem} disabled={!newItemLabel.trim()} className="text-[#4caf50] text-xs font-medium hover:text-[#66bb6a] disabled:opacity-50">Add</button>
                                <button onClick={() => setAddingItemSectionId(null)} className="text-[#888] text-xs hover:text-white">Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => { setAddingItemSectionId(section.id); setNewItemLabel(''); }} className="text-[#4caf50] text-xs font-medium py-1.5 hover:text-[#66bb6a] transition-colors">+ Add item</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}
          </>
        )}

        <div className="mt-14 text-center">
          <Link href="/privacy" className="text-[#666] text-[11px] hover:text-[#888] transition-colors">Privacy Policy</Link>
        </div>
      </main>
    </div>
  );
}
