'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { checkAuth } from '@/lib/auth';
import AdminNav from '@/components/AdminNav';
import { ALL_SIGNOFF_ROLES, SIGNOFF_ROLE_LABELS } from '@/lib/signoff';
import type { Attraction, UserRole, SignoffPin, SignoffRoleKey } from '@/types/database';

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
      <div className="bg-[#111] border border-[#2a2a2a] p-6 w-full max-w-[400px] rounded-xl">
        <p className="text-[#F1F5F9] text-sm font-semibold mb-1.5">{title}</p>
        <p className="text-[#94A3B8] text-sm mb-5">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-[#2a2a2a] text-[#94A3B8] hover:border-[#555] hover:text-[#F1F5F9]
                       rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded-lg
                       text-sm font-semibold transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── User Form Modal ── */
function UserFormModal({
  open,
  editing,
  attractions,
  existingPin,
  allPins,
  onSave,
  onCancel,
  isPinOnlyUser,
}: {
  open: boolean;
  editing: UserRole | null;
  attractions: Attraction[];
  existingPin: SignoffPin | null;
  allPins: Map<string, SignoffPin>;
  onSave: (data: {
    email: string;
    displayName: string;
    role: 'admin' | 'supervisor';
    allowedAttractions: string[];
    pin: string;
    signoffRoles: SignoffRoleKey[];
    pinOnly: boolean;
  }) => Promise<string | null>;
  onCancel: () => void;
  isPinOnlyUser: (user: UserRole) => boolean;
}) {
  const [formEmail, setFormEmail] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formRole, setFormRole] = useState<'admin' | 'supervisor'>('supervisor');
  const [formAttractions, setFormAttractions] = useState<string[]>([]);
  const [formPin, setFormPin] = useState('');
  const [formSignoffRoles, setFormSignoffRoles] = useState<SignoffRoleKey[]>([]);
  const [formPinOnly, setFormPinOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const rides = attractions.filter((a) => a.attraction_type !== 'show');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const pinOnly = isPinOnlyUser(editing);
      setFormPinOnly(pinOnly);
      setFormEmail(pinOnly ? '' : editing.email);
      setFormDisplayName(editing.display_name || '');
      setFormRole(editing.role);
      setFormAttractions(editing.allowed_attractions || []);
      setFormPin(existingPin?.pin || '');
      setFormSignoffRoles(existingPin?.signoff_roles || []);
    } else {
      setFormPinOnly(false);
      setFormEmail('');
      setFormDisplayName('');
      setFormRole('supervisor');
      setFormAttractions([]);
      setFormPin('');
      setFormSignoffRoles([]);
    }
    setFormError('');
    setSaving(false);
  }, [open, editing, existingPin, isPinOnlyUser]);

  if (!open) return null;

  function toggleAttraction(id: string) {
    setFormAttractions((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }

  function toggleSignoffRole(role: SignoffRoleKey) {
    setFormSignoffRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  async function handleSubmit() {
    if (!formPinOnly && !formEmail.trim()) {
      setFormError('Email is required.');
      return;
    }
    if (formPinOnly && !formDisplayName.trim()) {
      setFormError('Display Name is required for PIN-only users.');
      return;
    }
    if (formPinOnly && !formPin.trim()) {
      setFormError('PIN is required for PIN-only users.');
      return;
    }
    if (formPin.trim() && formPin.trim().length !== 4) {
      setFormError('PIN must be exactly 4 digits.');
      return;
    }
    if (formPin.trim()) {
      const duplicate = Array.from(allPins.entries()).find(
        ([userId, p]) => p.pin === formPin.trim() && (!editing || userId !== editing.id)
      );
      if (duplicate) {
        setFormError('This PIN is already in use by another user.');
        return;
      }
    }
    setSaving(true);
    setFormError('');

    const err = await onSave({
      email: formEmail,
      displayName: formDisplayName,
      role: formRole,
      allowedAttractions: formAttractions,
      pin: formPin,
      signoffRoles: formSignoffRoles,
      pinOnly: formPinOnly,
    });

    if (err) {
      setFormError(err);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4" style={{ overflowY: 'auto' }}>
      <div className="bg-[#111] border border-[#2a2a2a] w-full max-w-[520px] my-8 rounded-xl" onClick={(e) => e.stopPropagation()}>
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <h3 className="text-[#F1F5F9] text-base font-semibold">
            {editing ? 'Edit User' : 'Add User'}
          </h3>
          <button onClick={onCancel} className="text-[#94A3B8] hover:text-[#F1F5F9] transition-colors p-1 rounded">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M5 5L13 13M13 5L5 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {formError && (
            <div className="bg-red-950/40 border border-red-700/40 rounded-lg p-3">
              <p className="text-red-300 text-sm">{formError}</p>
            </div>
          )}

          {/* PIN-only toggle */}
          {!editing && (
            <label className="flex items-center gap-3 cursor-pointer px-4 py-3 bg-[#000] border border-[#2a2a2a] rounded-lg hover:border-[#3B82F6]/40 transition-colors">
              <input
                type="checkbox"
                checked={formPinOnly}
                onChange={(e) => setFormPinOnly(e.target.checked)}
                className="w-4 h-4"
                style={{ accentColor: '#3B82F6' }}
              />
              <div>
                <span className="text-[#F1F5F9] text-sm font-medium">PIN-only user</span>
                <p className="text-[#94A3B8] text-xs mt-0.5">No email/password login — sign-off only</p>
              </div>
            </label>
          )}

          {/* Basic info section */}
          <div>
            <p className="text-[#94A3B8] text-xs font-semibold uppercase tracking-wider mb-3">Basic Info</p>
            <div className="space-y-3">
              {!formPinOnly && (
                <div>
                  <label className="block text-[#94A3B8] text-[13px] font-medium mb-1.5">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    disabled={!!editing}
                    placeholder="user@example.com"
                    className="w-full px-3.5 py-2.5 bg-[#000] border border-[#2a2a2a] rounded-lg text-[#F1F5F9] text-sm
                               placeholder-[#475569] focus:outline-none focus:border-[#3B82F6] focus:shadow-[0_0_0_2px_rgba(59,130,246,0.15)] transition-colors
                               disabled:opacity-40"
                  />
                </div>
              )}
              <div>
                <label className="block text-[#94A3B8] text-[13px] font-medium mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  placeholder="e.g. John S."
                  className="w-full px-3.5 py-2.5 bg-[#000] border border-[#2a2a2a] rounded-lg text-[#F1F5F9] text-sm
                             placeholder-[#475569] focus:outline-none focus:border-[#3B82F6] focus:shadow-[0_0_0_2px_rgba(59,130,246,0.15)] transition-colors"
                />
              </div>
              {!formPinOnly && (
                <div>
                  <label className="block text-[#94A3B8] text-[13px] font-medium mb-1.5">Role</label>
                  <div className="flex gap-2 p-1 bg-[#000] border border-[#2a2a2a] rounded-lg">
                    {(['supervisor', 'admin'] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setFormRole(r)}
                        className={`flex-1 py-2 rounded-md text-sm font-medium capitalize transition-all
                          ${formRole === r
                            ? r === 'admin'
                              ? 'bg-red-950/60 text-red-400 shadow-sm'
                              : 'bg-blue-950/60 text-blue-400 shadow-sm'
                            : 'text-[#94A3B8] hover:text-[#94A3B8]'
                          }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[#2a2a2a]" />

          {/* Sign-off section */}
          <div>
            <p className="text-[#94A3B8] text-xs font-semibold uppercase tracking-wider mb-3">Sign-Off</p>
            <div className="space-y-3">
              <div>
                <label className="block text-[#94A3B8] text-[13px] font-medium mb-1.5">4-Digit PIN</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={formPin}
                    onChange={(e) => setFormPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="0000"
                    className="flex-1 px-3.5 py-2.5 bg-[#000] border border-[#2a2a2a] rounded-lg text-[#F1F5F9] text-sm
                               placeholder-[#475569] focus:outline-none focus:border-[#3B82F6] focus:shadow-[0_0_0_2px_rgba(59,130,246,0.15)] transition-colors
                               tracking-[0.4em] font-mono text-center text-lg"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const pin = String(Math.floor(1000 + Math.random() * 9000));
                      setFormPin(pin);
                    }}
                    className="px-3.5 py-2.5 border border-[#2a2a2a] rounded-lg text-[#94A3B8] text-xs font-semibold
                               hover:border-[#555] hover:text-[#F1F5F9] transition-colors whitespace-nowrap"
                  >
                    Generate
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[#94A3B8] text-[13px] font-medium mb-1.5">Roles</label>
                <div className="space-y-1.5">
                  {ALL_SIGNOFF_ROLES.map((role) => {
                    const checked = formSignoffRoles.includes(role);
                    return (
                      <button
                        key={role}
                        onClick={() => toggleSignoffRole(role)}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-left transition-colors border
                          ${checked ? 'bg-emerald-950/40 border-emerald-700/40 text-emerald-400' : 'bg-[#000] border-[#2a2a2a] text-[#94A3B8] hover:border-[#555]'}`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors
                          ${checked ? 'bg-emerald-600' : 'border border-[#555]'}`}>
                          {checked && (
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        <span className="text-sm">{SIGNOFF_ROLE_LABELS[role]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Allowed attractions (supervisors only) */}
          {(formRole === 'supervisor' || formPinOnly) && (
            <>
              <div className="border-t border-[#2a2a2a]" />
              <div>
                <p className="text-[#94A3B8] text-xs font-semibold uppercase tracking-wider mb-1">Allowed Attractions</p>
                <p className="text-[#94A3B8] text-xs mb-3">Leave empty for all attractions.</p>
                <div className="space-y-1.5">
                  {rides.map((a) => {
                    const checked = formAttractions.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        onClick={() => toggleAttraction(a.id)}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-left transition-colors border
                          ${checked ? 'bg-[#111] border-[#555] text-[#F1F5F9]' : 'bg-[#000] border-[#2a2a2a] text-[#94A3B8] hover:border-[#555]'}`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors
                          ${checked ? 'bg-emerald-600' : 'border border-[#555]'}`}>
                          {checked && (
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        <span className="text-sm">{a.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-[#2a2a2a]">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-[#2a2a2a] text-[#94A3B8] text-sm font-medium
                       rounded-lg hover:border-[#555] hover:text-[#F1F5F9] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2.5 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-semibold rounded-lg
                       transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
}

type FilterTab = 'all' | 'admin' | 'supervisor' | 'pin';

export default function UsersPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRole[]>([]);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [pinData, setPinData] = useState<Map<string, SignoffPin>>(new Map());
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<UserRole | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRole | null>(null);
  // PIN reveal state: set of user IDs with PIN visible
  const [revealedPins, setRevealedPins] = useState<Set<string>>(new Set());

  const fetchUsers = useCallback(async () => {
    const [usersRes, pinsRes] = await Promise.all([
      supabase.from('user_roles').select('*').order('created_at', { ascending: true }),
      supabase.from('signoff_pins').select('*'),
    ]);
    if (usersRes.data) setUsers(usersRes.data);
    if (pinsRes.data) {
      const map = new Map<string, SignoffPin>();
      for (const p of pinsRes.data) map.set(p.user_id, p);
      setPinData(map);
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

      const [usersRes, attractionsRes, pinsRes] = await Promise.all([
        supabase.from('user_roles').select('*').order('created_at', { ascending: true }),
        supabase.from('attractions').select('*').order('sort_order', { ascending: true }),
        supabase.from('signoff_pins').select('*'),
      ]);

      if (usersRes.data) setUsers(usersRes.data);
      if (attractionsRes.data) setAttractions(attractionsRes.data);
      if (pinsRes.data) {
        const map = new Map<string, SignoffPin>();
        for (const p of pinsRes.data) map.set(p.user_id, p);
        setPinData(map);
      }
      setLoading(false);
    }
    init();
  }, [router, fetchUsers]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  function isPinOnlyUser(user: UserRole): boolean {
    return user.email.endsWith('@signoff.local');
  }

  function startEdit(user: UserRole) {
    setEditing(user);
    setShowForm(true);
  }

  function startAdd() {
    setEditing(null);
    setShowForm(true);
  }

  async function handleSave(data: {
    email: string;
    displayName: string;
    role: 'admin' | 'supervisor';
    allowedAttractions: string[];
    pin: string;
    signoffRoles: SignoffRoleKey[];
    pinOnly: boolean;
  }): Promise<string | null> {
    let email: string;
    if (data.pinOnly) {
      if (editing && isPinOnlyUser(editing)) {
        email = editing.email;
      } else {
        email = `pin-${crypto.randomUUID().slice(0, 8)}@signoff.local`;
      }
    } else {
      email = data.email.trim().toLowerCase();
    }

    const payload = {
      email,
      display_name: data.displayName.trim() || null,
      role: data.pinOnly ? ('supervisor' as const) : data.role,
      allowed_attractions: data.role === 'admin' && !data.pinOnly ? null : data.allowedAttractions.length > 0 ? data.allowedAttractions : null,
      updated_at: new Date().toISOString(),
    };

    if (editing) {
      const { error } = await supabase
        .from('user_roles')
        .update(payload)
        .eq('id', editing.id);
      if (error) {
        if (process.env.NODE_ENV === 'development') console.error('User update error:', error);
        return 'Failed to update user. Please try again.';
      }
    } else {
      const { error } = await supabase
        .from('user_roles')
        .insert({ ...payload, created_at: new Date().toISOString() });
      if (error) {
        if (process.env.NODE_ENV === 'development') console.error('User create error:', error);
        return error.message?.includes('duplicate') ? 'A user with this email already exists.' : 'Failed to create user. Please try again.';
      }
    }

    const { data: freshUsers } = await supabase
      .from('user_roles')
      .select('*')
      .order('created_at', { ascending: true });

    if (freshUsers) setUsers(freshUsers);

    const targetUser = (freshUsers || []).find((u: UserRole) => u.email === email);

    if (targetUser) {
      const trimmedPin = data.pin.trim();
      if (trimmedPin || data.signoffRoles.length > 0) {
        await supabase.from('signoff_pins').upsert(
          {
            user_id: targetUser.id,
            pin: trimmedPin,
            signoff_roles: data.signoffRoles,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
      } else {
        await supabase.from('signoff_pins').delete().eq('user_id', targetUser.id);
      }
    }

    const { data: freshPins } = await supabase.from('signoff_pins').select('*');
    if (freshPins) {
      const map = new Map<string, SignoffPin>();
      for (const p of freshPins) map.set(p.user_id, p);
      setPinData(map);
    }

    setShowForm(false);
    setEditing(null);
    return null;
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await supabase.from('user_roles').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    await fetchUsers();
  }

  function getAttractionNames(ids: string[] | null): string {
    if (!ids || ids.length === 0) return 'All attractions';
    return ids
      .map((id) => attractions.find((a) => a.id === id)?.name || id.slice(0, 8))
      .join(', ');
  }

  function togglePinReveal(userId: string) {
    setRevealedPins((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  // Group users
  const admins = users.filter((u) => u.role === 'admin' && !isPinOnlyUser(u));
  const supervisors = users.filter((u) => u.role === 'supervisor' && !isPinOnlyUser(u));
  const pinOnlyUsers = users.filter((u) => isPinOnlyUser(u));

  // Sorted unified list: admins first, supervisors, pin-only, alphabetical within group
  const sortedUsers = [
    ...admins.sort((a, b) => (a.display_name || a.email).localeCompare(b.display_name || b.email)),
    ...supervisors.sort((a, b) => (a.display_name || a.email).localeCompare(b.display_name || b.email)),
    ...pinOnlyUsers.sort((a, b) => (a.display_name || a.email).localeCompare(b.display_name || b.email)),
  ];

  const filteredUsers = sortedUsers.filter((u) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'admin') return u.role === 'admin' && !isPinOnlyUser(u);
    if (activeTab === 'supervisor') return u.role === 'supervisor' && !isPinOnlyUser(u);
    if (activeTab === 'pin') return isPinOnlyUser(u);
    return true;
  });

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: users.length },
    { key: 'admin', label: 'Admin', count: admins.length },
    { key: 'supervisor', label: 'Supervisor', count: supervisors.length },
    { key: 'pin', label: 'PIN Only', count: pinOnlyUsers.length },
  ];

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#000]">
        <div className="text-[#94A3B8] text-sm">Loading...</div>
      </div>
    );
  }

  function renderUserRow(user: UserRole) {
    const pin = pinData.get(user.id);
    const pinOnly = isPinOnlyUser(user);
    const isYou = user.email === userEmail;
    const pinRevealed = revealedPins.has(user.id);

    const avatarBg = user.role === 'admin' && !pinOnly
      ? { bg: 'rgba(220,38,38,0.15)', color: '#f87171', border: 'rgba(220,38,38,0.3)' }
      : pinOnly
        ? { bg: 'rgba(100,100,100,0.15)', color: '#94A3B8', border: 'rgba(100,100,100,0.3)' }
        : { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: 'rgba(59,130,246,0.3)' };

    const roleBadge = user.role === 'admin' && !pinOnly
      ? { bg: 'rgba(220,38,38,0.1)', color: '#f87171', label: 'Admin' }
      : pinOnly
        ? { bg: 'rgba(100,100,100,0.1)', color: '#94A3B8', label: 'PIN Only' }
        : { bg: 'rgba(59,130,246,0.1)', color: '#60a5fa', label: 'Supervisor' };

    return (
      <div
        key={user.id}
        style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}
      >
        {/* Avatar */}
        <div
          style={{ flexShrink: 0, width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, background: avatarBg.bg, color: avatarBg.color, border: `1.5px solid ${avatarBg.border}` }}
        >
          {(user.display_name || user.email).charAt(0).toUpperCase()}
        </div>

        {/* Name + meta — takes remaining space */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Row 1: name + role badge + "you" chip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: '#F1F5F9', fontSize: 14, fontWeight: 600 }}>
              {user.display_name || (pinOnly ? 'PIN User' : user.email.split('@')[0])}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', padding: '2px 7px', borderRadius: 4, background: roleBadge.bg, color: roleBadge.color }}>
              {roleBadge.label}
            </span>
            {isYou && (
              <span style={{ fontSize: 10, padding: '2px 6px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#94A3B8', borderRadius: 4, fontWeight: 500 }}>you</span>
            )}
          </div>
          {/* Row 2: email / sign-off roles / attractions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            {!pinOnly && (
              <span style={{ color: '#94A3B8', fontSize: 12 }}>{user.email}</span>
            )}
            {pin && pin.signoff_roles && pin.signoff_roles.length > 0 && (
              <span style={{ color: '#94A3B8', fontSize: 12 }}>
                {pin.signoff_roles.map((r) => SIGNOFF_ROLE_LABELS[r as SignoffRoleKey] || r).join(' · ')}
              </span>
            )}
            {user.role !== 'admin' && (
              <span style={{ color: '#64748B', fontSize: 12 }}>
                {getAttractionNames(user.allowed_attractions)}
              </span>
            )}
          </div>
        </div>

        {/* PIN reveal — always visible */}
        {pin?.pin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#94A3B8', letterSpacing: '0.2em', minWidth: 40, textAlign: 'center' }}>
              {pinRevealed ? pin.pin : '••••'}
            </span>
            <button
              onClick={() => togglePinReveal(user.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 2, display: 'flex', alignItems: 'center' }}
              title={pinRevealed ? 'Hide PIN' : 'Show PIN'}
            >
              {pinRevealed ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </div>
        )}

        {/* Actions — always visible */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => startEdit(user)}
            className="px-2.5 py-1 text-[12px] font-medium text-[#94A3B8] hover:text-[#F1F5F9] transition-colors rounded"
          >
            Edit
          </button>
          {!isYou && (
            <button
              onClick={() => setDeleteTarget(user)}
              className="px-2.5 py-1 text-[12px] font-medium text-[#94A3B8] hover:text-red-400 transition-colors rounded"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#000]">
      <AdminNav userEmail={userEmail} displayName={displayName} onLogout={handleLogout} />

      <ConfirmModal
        open={!!deleteTarget}
        title={`Remove "${deleteTarget && isPinOnlyUser(deleteTarget) ? (deleteTarget.display_name || 'PIN user') : deleteTarget?.email}"?`}
        message="This user will lose all access. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <UserFormModal
        open={showForm}
        editing={editing}
        attractions={attractions}
        existingPin={editing ? pinData.get(editing.id) || null : null}
        allPins={pinData}
        onSave={handleSave}
        onCancel={() => { setShowForm(false); setEditing(null); }}
        isPinOnlyUser={isPinOnlyUser}
      />

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px' }}>
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[#F1F5F9] text-2xl font-bold">Users</h2>
          <button
            onClick={startAdd}
            className="flex items-center gap-2 px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Add User
          </button>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, background: '#111', border: '1px solid #1a1a1a', borderRadius: 10, padding: 4 }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '8px 12px',
                borderRadius: 7,
                fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 500,
                border: 'none', cursor: 'pointer',
                background: activeTab === tab.key ? '#1E1E1E' : 'transparent',
                color: activeTab === tab.key ? '#F1F5F9' : '#94A3B8',
                transition: 'background 0.15s, color 0.15s',
                boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
              }}
            >
              {tab.label}
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                background: activeTab === tab.key ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)',
                color: activeTab === tab.key ? '#60A5FA' : '#64748B',
              }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* User list */}
        {users.length === 0 ? (
          <div className="bg-[#111] border border-[#2a2a2a] p-16 text-center rounded-xl">
            <p className="text-[#94A3B8] text-sm">No users configured yet.</p>
            <p className="text-[#64748B] text-xs mt-2">Click &ldquo;Add User&rdquo; to get started.</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-[#111] border border-[#2a2a2a] p-12 text-center rounded-xl">
            <p className="text-[#94A3B8] text-sm">No users in this category.</p>
          </div>
        ) : (
          <div style={{ border: '1px solid #1a1a1a', borderRadius: 12, overflow: 'hidden' }}>
            {filteredUsers.map((user, idx) => (
              <div key={user.id} style={{ borderTop: idx === 0 ? 'none' : '1px solid #1a1a1a' }}>
                {renderUserRow(user)}
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 text-center">
          <Link href="/privacy" className="text-[#64748B] text-[11px] no-underline hover:text-[#555]">
            Privacy Policy
          </Link>
        </div>
      </main>
    </div>
  );
}
