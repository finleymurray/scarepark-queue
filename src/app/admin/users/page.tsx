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
      <div className="bg-[#1a1a1a] border border-[#444] rounded-xl p-6 w-full max-w-[400px]">
        <p className="text-white text-base font-semibold mb-2">{title}</p>
        <p className="text-white/50 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-5 py-3 bg-[#1a1a1a] border border-[#444] text-white/60 hover:text-white
                       rounded-xl text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-5 py-3 bg-[#d43518] hover:bg-[#b52d14] text-white rounded-xl
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
  onSave,
  onCancel,
  isPinOnlyUser,
}: {
  open: boolean;
  editing: UserRole | null;
  attractions: Attraction[];
  existingPin: SignoffPin | null;
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
      <div className="bg-[#111] border border-[#333] rounded-xl w-full max-w-lg my-8" onClick={(e) => e.stopPropagation()}>
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222]">
          <h3 className="text-white text-base font-semibold">
            {editing ? 'Edit User' : 'Add User'}
          </h3>
          <button onClick={onCancel} className="text-white/30 hover:text-white transition-colors p-1">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M5 5L13 13M13 5L5 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {formError && (
            <div className="bg-[#2a1010] border border-[#d43518]/30 rounded-lg p-3">
              <p className="text-[#f0a0a0] text-sm">{formError}</p>
            </div>
          )}

          {/* PIN-only toggle */}
          {!editing && (
            <label className="flex items-center gap-3 cursor-pointer px-4 py-3 bg-[#1a1a1a] border border-[#333] rounded-xl">
              <input
                type="checkbox"
                checked={formPinOnly}
                onChange={(e) => setFormPinOnly(e.target.checked)}
                className="accent-[#6ea8fe] w-4 h-4"
              />
              <div>
                <span className="text-white text-sm font-medium">PIN-only user</span>
                <p className="text-white/30 text-xs mt-0.5">No email/password login — sign-off only</p>
              </div>
            </label>
          )}

          {/* Basic info */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
              <span className="text-white/50 text-xs uppercase tracking-wider font-semibold">Basic Info</span>
            </div>
            <div className="space-y-3">
              {!formPinOnly && (
                <div>
                  <label className="block text-white/50 text-xs font-medium mb-1.5">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    disabled={!!editing}
                    placeholder="user@example.com"
                    className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#333] rounded-xl text-white text-sm
                               placeholder-white/20 focus:outline-none focus:border-[#555] transition-colors
                               disabled:opacity-40"
                  />
                </div>
              )}
              <div>
                <label className="block text-white/50 text-xs font-medium mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  placeholder="e.g. John S."
                  className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#333] rounded-xl text-white text-sm
                             placeholder-white/20 focus:outline-none focus:border-[#555] transition-colors"
                />
              </div>
              {!formPinOnly && (
                <div>
                  <label className="block text-white/50 text-xs font-medium mb-1.5">Role</label>
                  <div className="flex gap-2">
                    {(['supervisor', 'admin'] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setFormRole(r)}
                        className={`flex-1 py-3 rounded-xl text-sm font-semibold capitalize transition-colors border
                          ${formRole === r
                            ? r === 'admin'
                              ? 'bg-[#0a3d1f] border-[#1a4a1a] text-[#4caf50]'
                              : 'bg-[#222] border-[#555] text-white'
                            : 'bg-[#1a1a1a] border-[#333] text-white/30'
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

          {/* Sign-off section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
              <span className="text-white/50 text-xs uppercase tracking-wider font-semibold">Sign-Off</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-white/50 text-xs font-medium mb-1.5">4-Digit PIN</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={formPin}
                    onChange={(e) => setFormPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="0000"
                    className="flex-1 px-4 py-3 bg-[#1a1a1a] border border-[#333] rounded-xl text-white text-sm
                               placeholder-white/20 focus:outline-none focus:border-[#555] transition-colors
                               tracking-[0.4em] font-mono text-center text-lg"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const pin = String(Math.floor(1000 + Math.random() * 9000));
                      setFormPin(pin);
                    }}
                    className="px-4 py-3 bg-[#1a1a1a] border border-[#333] rounded-xl text-white/50 text-xs font-semibold
                               hover:border-[#555] hover:text-white transition-colors whitespace-nowrap"
                  >
                    Generate
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-white/50 text-xs font-medium mb-2">Roles</label>
                <div className="grid grid-cols-1 gap-2">
                  {ALL_SIGNOFF_ROLES.map((role) => {
                    const checked = formSignoffRoles.includes(role);
                    return (
                      <button
                        key={role}
                        onClick={() => toggleSignoffRole(role)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors border
                          ${checked ? 'bg-[#1a2a3a] border-[#2a4a6a] text-[#6ea8fe]' : 'bg-[#1a1a1a] border-[#333] text-white/40'}`}
                      >
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors
                          ${checked ? 'bg-[#6ea8fe] border-[#6ea8fe]' : 'border-[#444] bg-transparent'}`}>
                          {checked && (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        <span className="text-sm font-medium">{SIGNOFF_ROLE_LABELS[role]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Allowed attractions (supervisors only) */}
          {(formRole === 'supervisor' || formPinOnly) && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                <span className="text-white/50 text-xs uppercase tracking-wider font-semibold">Allowed Attractions</span>
              </div>
              <p className="text-white/20 text-xs mb-2">Leave empty for all attractions.</p>
              <div className="grid grid-cols-1 gap-2">
                {rides.map((a) => {
                  const checked = formAttractions.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => toggleAttraction(a.id)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors border
                        ${checked ? 'bg-[#222] border-[#555] text-white' : 'bg-[#1a1a1a] border-[#333] text-white/40'}`}
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors
                        ${checked ? 'bg-white border-white' : 'border-[#444] bg-transparent'}`}>
                        {checked && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <span className="text-sm font-medium">{a.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-[#222]">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-[#1a1a1a] border border-[#333] text-white/50 text-sm font-semibold
                       rounded-xl hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-3 bg-white text-black text-sm font-bold rounded-xl
                       hover:bg-white/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRole[]>([]);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [pinData, setPinData] = useState<Map<string, SignoffPin>>(new Map());

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<UserRole | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRole | null>(null);

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
      if (error) return error.message;
    } else {
      const { error } = await supabase
        .from('user_roles')
        .insert({ ...payload, created_at: new Date().toISOString() });
      if (error) return error.message.includes('duplicate') ? 'A user with this email already exists.' : error.message;
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

  // Group users
  const admins = users.filter((u) => u.role === 'admin' && !isPinOnlyUser(u));
  const supervisors = users.filter((u) => u.role === 'supervisor' && !isPinOnlyUser(u));
  const pinOnlyUsers = users.filter((u) => isPinOnlyUser(u));

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="text-white/30 text-sm">Loading...</div>
      </div>
    );
  }

  function renderUserCard(user: UserRole) {
    const pin = pinData.get(user.id);
    const pinOnly = isPinOnlyUser(user);
    const isYou = user.email === userEmail;

    return (
      <div
        key={user.id}
        className="bg-[#111] border border-[#333] rounded-xl p-5 transition-colors hover:border-[#444]"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0
              ${user.role === 'admin' ? 'bg-[#0a3d1f] text-[#4caf50]' : pinOnly ? 'bg-[#1a2a3a] text-[#6ea8fe]' : 'bg-[#3d3000] text-[#ffc107]'}`}>
              {(user.display_name || user.email).charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white text-sm font-semibold">
                  {user.display_name || (pinOnly ? 'PIN User' : user.email.split('@')[0])}
                </span>
                {isYou && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-[#222] text-white/30 rounded font-medium">you</span>
                )}
              </div>
              {!pinOnly && (
                <p className="text-white/30 text-xs mt-0.5">{user.email}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => startEdit(user)}
              className="px-3 py-1.5 border border-[#333] text-white/40 text-xs font-medium rounded-lg
                         hover:border-[#555] hover:text-white transition-colors"
            >
              Edit
            </button>
            {!isYou && (
              <button
                onClick={() => setDeleteTarget(user)}
                className="px-3 py-1.5 bg-[#2a1010] text-[#d43518] text-xs font-semibold rounded-lg
                           hover:bg-[#3a1515] transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Info row */}
        <div className="flex flex-wrap gap-2">
          {/* Role badge */}
          <span className={`text-[10px] px-2 py-1 rounded-lg font-semibold uppercase
            ${user.role === 'admin' ? 'bg-[#0a3d1f] text-[#4caf50]' : pinOnly ? 'bg-[#1a2a3a] text-[#6ea8fe]' : 'bg-[#3d3000] text-[#ffc107]'}`}>
            {pinOnly ? 'PIN only' : user.role}
          </span>

          {/* PIN display */}
          {pin?.pin ? (
            <span className="text-[10px] px-2 py-1 rounded-lg font-mono font-semibold bg-[#1a1a1a] text-white/60 tracking-widest">
              PIN: {pin.pin}
            </span>
          ) : null}

          {/* Attraction access */}
          {user.role !== 'admin' && (
            <span className="text-[10px] px-2 py-1 rounded-lg font-medium bg-[#1a1a1a] text-white/30">
              {getAttractionNames(user.allowed_attractions)}
            </span>
          )}
        </div>

        {/* Sign-off roles */}
        {pin && pin.signoff_roles && pin.signoff_roles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-[#222]">
            {pin.signoff_roles.map((r) => (
              <span key={r} className="text-[10px] px-2 py-1 bg-[#1a2a3a] text-[#6ea8fe] rounded-lg font-medium">
                {SIGNOFF_ROLE_LABELS[r as SignoffRoleKey] || r}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderGroup(label: string, groupUsers: UserRole[], badgeColor: string, badgeTextColor: string) {
    if (groupUsers.length === 0) return null;
    return (
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-4">
          <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase`}
                style={{ background: badgeColor, color: badgeTextColor }}>
            {label}
          </span>
          <span className="text-white/20 text-xs">{groupUsers.length}</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {groupUsers.map(renderUserCard)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
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
        onSave={handleSave}
        onCancel={() => { setShowForm(false); setEditing(null); }}
        isPinOnlyUser={isPinOnlyUser}
      />

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white text-2xl font-bold">Users</h2>
          <button
            onClick={startAdd}
            className="flex items-center gap-2 px-5 py-3 bg-white text-black text-sm font-bold rounded-xl
                       hover:bg-white/90 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Add User
          </button>
        </div>

        {users.length === 0 ? (
          <div className="bg-[#111] border border-[#333] rounded-xl p-12 text-center">
            <p className="text-white/30 text-sm">No users configured yet.</p>
            <p className="text-white/15 text-xs mt-2">Click &ldquo;Add User&rdquo; to get started.</p>
          </div>
        ) : (
          <>
            {renderGroup('Admins', admins, '#0a3d1f', '#4caf50')}
            {renderGroup('Supervisors', supervisors, '#3d3000', '#ffc107')}
            {renderGroup('PIN-Only', pinOnlyUsers, '#1a2a3a', '#6ea8fe')}
          </>
        )}

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Link href="/privacy" style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, textDecoration: 'none' }}>
            Privacy Policy
          </Link>
        </div>
      </main>
    </div>
  );
}
