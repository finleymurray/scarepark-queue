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
      <div className="bg-[#1E1E1E] border border-[#2a2a2a] p-8 w-full max-w-[400px]" style={{ borderRadius: 14 }}>
        <p className="text-[#e0e0e0] text-sm font-semibold mb-2">{title}</p>
        <p className="text-[#888] text-sm mb-5">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-5 py-2.5 border border-[#555] text-[#ccc] hover:border-[#888] hover:text-white
                       rounded-[6px] text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-5 py-2.5 bg-[#d43518] hover:bg-[#b52d14] text-white rounded-[6px]
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
      <div className="bg-[#1E1E1E] border border-[#2a2a2a] w-full max-w-lg my-8" style={{ borderRadius: 14 }} onClick={(e) => e.stopPropagation()}>
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#333]">
          <h3 className="text-[#e0e0e0] text-base font-semibold">
            {editing ? 'Edit User' : 'Add User'}
          </h3>
          <button onClick={onCancel} className="text-[#666] hover:text-[#e0e0e0] transition-colors p-1">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M5 5L13 13M13 5L5 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-6 space-y-6" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {formError && (
            <div className="bg-[#2a1010] border border-[#d43518] rounded-[6px] p-3">
              <p className="text-[#f0a0a0] text-sm">{formError}</p>
            </div>
          )}

          {/* PIN-only toggle */}
          {!editing && (
            <label className="flex items-center gap-3 cursor-pointer px-4 py-3 bg-[#1a1a1a] border border-[#333] rounded-[6px]">
              <input
                type="checkbox"
                checked={formPinOnly}
                onChange={(e) => setFormPinOnly(e.target.checked)}
                className="w-4 h-4"
                style={{ accentColor: '#6ea8fe' }}
              />
              <div>
                <span className="text-[#e0e0e0] text-sm font-medium">PIN-only user</span>
                <p className="text-[#888] text-xs mt-0.5">No email/password login — sign-off only</p>
              </div>
            </label>
          )}

          {/* Section 1: Basic info */}
          <fieldset className="border border-[#333] rounded-[8px] p-5 mb-5 bg-[#111]">
            <legend className="text-sm font-semibold text-white px-2 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 bg-white text-black rounded-full text-xs font-bold">1</span>
              Basic Info
            </legend>
            <div className="space-y-4">
              {!formPinOnly && (
                <div>
                  <label className="block text-[#ccc] text-[13px] font-medium mb-2">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    disabled={!!editing}
                    placeholder="user@example.com"
                    className="w-full px-4 py-3.5 bg-[#1a1a1a] border border-[#444] rounded-[6px] text-[#e0e0e0] text-sm
                               placeholder-[#666] focus:outline-none focus:border-[#6ea8fe] focus:shadow-[0_0_0_2px_rgba(110,168,254,0.2)] transition-colors
                               disabled:opacity-40"
                  />
                </div>
              )}
              <div>
                <label className="block text-[#ccc] text-[13px] font-medium mb-2">Display Name</label>
                <input
                  type="text"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  placeholder="e.g. John S."
                  className="w-full px-4 py-3.5 bg-[#1a1a1a] border border-[#444] rounded-[6px] text-[#e0e0e0] text-sm
                             placeholder-[#666] focus:outline-none focus:border-[#6ea8fe] focus:shadow-[0_0_0_2px_rgba(110,168,254,0.2)] transition-colors"
                />
              </div>
              {!formPinOnly && (
                <div>
                  <label className="block text-[#ccc] text-[13px] font-medium mb-2">Role</label>
                  <div className="flex gap-2">
                    {(['supervisor', 'admin'] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setFormRole(r)}
                        className={`flex-1 py-3.5 rounded-[6px] text-sm font-semibold capitalize transition-colors border
                          ${formRole === r
                            ? r === 'admin'
                              ? 'bg-[#0a3d1f] border-[#0a3d1f] text-[#4caf50]'
                              : 'bg-[#1a1a1a] border-[#555] text-[#e0e0e0]'
                            : 'bg-[#111] border-[#333] text-[#666]'
                          }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </fieldset>

          {/* Section 2: Sign-off */}
          <fieldset className="border border-[#333] rounded-[8px] p-5 mb-5 bg-[#111]">
            <legend className="text-sm font-semibold text-white px-2 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 bg-white text-black rounded-full text-xs font-bold">2</span>
              Sign-Off
            </legend>
            <div className="space-y-4">
              <div>
                <label className="block text-[#ccc] text-[13px] font-medium mb-2">4-Digit PIN</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={formPin}
                    onChange={(e) => setFormPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="0000"
                    className="flex-1 px-4 py-3.5 bg-[#1a1a1a] border border-[#444] rounded-[6px] text-[#e0e0e0] text-sm
                               placeholder-[#666] focus:outline-none focus:border-[#6ea8fe] focus:shadow-[0_0_0_2px_rgba(110,168,254,0.2)] transition-colors
                               tracking-[0.4em] font-mono text-center text-lg"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const pin = String(Math.floor(1000 + Math.random() * 9000));
                      setFormPin(pin);
                    }}
                    className="px-4 py-3.5 border border-[#555] rounded-[6px] text-[#ccc] text-xs font-semibold
                               hover:border-[#888] hover:text-white transition-colors whitespace-nowrap"
                  >
                    Generate
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[#ccc] text-[13px] font-medium mb-2">Roles</label>
                <div className="grid grid-cols-1 gap-2">
                  {ALL_SIGNOFF_ROLES.map((role) => {
                    const checked = formSignoffRoles.includes(role);
                    return (
                      <button
                        key={role}
                        onClick={() => toggleSignoffRole(role)}
                        className={`flex items-center gap-3 px-5 py-4 rounded-[6px] text-left transition-colors border
                          ${checked ? 'bg-[#0a3d1f] border-[#4caf50] text-[#4caf50]' : 'bg-[#1a1a1a] border-[#333] text-[#888]'}`}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors
                          ${checked ? 'bg-[#4caf50]' : 'border-2 border-[#555]'}`}>
                          {checked && (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
          </fieldset>

          {/* Section 3: Allowed attractions (supervisors only) */}
          {(formRole === 'supervisor' || formPinOnly) && (
            <fieldset className="border border-[#333] rounded-[8px] p-5 mb-5 bg-[#111]">
              <legend className="text-sm font-semibold text-white px-2 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 bg-white text-black rounded-full text-xs font-bold">3</span>
                Allowed Attractions
              </legend>
              <p className="text-[#888] text-xs mb-2">Leave empty for all attractions.</p>
              <div className="grid grid-cols-1 gap-2">
                {rides.map((a) => {
                  const checked = formAttractions.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => toggleAttraction(a.id)}
                      className={`flex items-center gap-3 px-5 py-4 rounded-[6px] text-left transition-colors border
                        ${checked ? 'bg-[#1a1a1a] border-[#555] text-[#e0e0e0]' : 'bg-[#111] border-[#333] text-[#666]'}`}
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors
                        ${checked ? 'bg-[#4caf50]' : 'border-2 border-[#555]'}`}>
                        {checked && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <span className="text-sm font-medium">{a.name}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
        </div>

        {/* Modal footer */}
        <div className="flex gap-3 px-6 py-5 border-t border-[#333]">
          <button
            onClick={onCancel}
            className="flex-1 py-3.5 border border-[#555] text-[#ccc] text-sm font-semibold
                       rounded-[6px] hover:border-[#888] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-3.5 bg-white text-black text-sm font-bold rounded-[6px]
                       hover:bg-[#ddd] transition-colors disabled:opacity-50"
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
        <div className="text-[#888] text-sm">Loading...</div>
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
        className="bg-[#1E1E1E] border border-[#2a2a2a] transition-colors hover:border-[#555]"
        style={{ padding: 32, borderRadius: 12 }}
      >
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div style={
              user.role === 'admin' && !pinOnly
                ? { width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0, background: 'rgba(10,61,31,0.6)', color: '#4caf50', border: '2px solid rgba(76,175,80,0.3)' }
                : pinOnly
                  ? { width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0, background: 'rgba(26,16,64,0.6)', color: '#a855f7', border: '2px solid rgba(168,85,247,0.3)' }
                  : { width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0, background: 'rgba(61,48,0,0.6)', color: '#ffc107', border: '2px solid rgba(255,193,7,0.3)' }
            }>
              {(user.display_name || user.email).charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[#e0e0e0] text-sm font-semibold">
                  {user.display_name || (pinOnly ? 'PIN User' : user.email.split('@')[0])}
                </span>
                {isYou && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-[#222] text-[#888] rounded font-medium">you</span>
                )}
              </div>
              {!pinOnly && (
                <p className="text-[#666] text-xs mt-0.5">{user.email}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => startEdit(user)}
              className="px-3 py-1.5 text-xs font-medium rounded-[6px]
                         hover:border-[#555] hover:text-[#e0e0e0] transition-colors"
              style={{ background: 'transparent', border: '1px solid #444', color: '#888' }}
            >
              Edit
            </button>
            {!isYou && (
              <button
                onClick={() => setDeleteTarget(user)}
                className="px-3 py-1.5 text-xs font-semibold rounded-[6px]
                           hover:brightness-125 transition-colors"
                style={{ background: 'rgba(220,53,69,0.12)', color: '#f87171', border: 'none' }}
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Info row */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Role badge */}
          <span className={`text-[10px] px-2 py-1 rounded-[12px] font-semibold uppercase
            ${user.role === 'admin' && !pinOnly ? 'bg-[#0a3d1f] text-[#4caf50]' : pinOnly ? 'bg-[#1a1040] text-[#a855f7]' : 'bg-[#3d3000] text-[#ffc107]'}`}>
            {pinOnly ? 'PIN only' : user.role}
          </span>

          {/* PIN display */}
          {pin?.pin ? (
            <span className="text-[10px] px-2 py-1 rounded-[12px] font-mono font-semibold bg-[#1a1a1a] text-[#888] tracking-widest border border-[#333]">
              PIN: {pin.pin}
            </span>
          ) : null}

          {/* Attraction access */}
          {user.role !== 'admin' && (
            <span className="text-[10px] px-2 py-1 rounded-[12px] font-medium bg-[#1a1a1a] text-[#666] border border-[#333]">
              {getAttractionNames(user.allowed_attractions)}
            </span>
          )}
        </div>

        {/* Sign-off roles */}
        {pin && pin.signoff_roles && pin.signoff_roles.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-5 pt-5 border-t border-[#333]">
            {pin.signoff_roles.map((r) => (
              <span key={r} className="text-[10px] px-2 py-1 bg-[#0a3d1f] text-[#4caf50] rounded-[12px] font-medium">
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
      <div style={{ marginBottom: 80 }}>
        <div className="flex items-center gap-3" style={{ marginBottom: 28 }}>
          <span className="text-[10px] px-2.5 py-1 rounded-[12px] font-bold uppercase"
                style={{ background: badgeColor, color: badgeTextColor }}>
            {label}
          </span>
          <span className="text-[#666] text-xs">{groupUsers.length}</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 24 }}>
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

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 28px' }}>
        {/* Page header */}
        <div className="flex items-center justify-between mb-10">
          <h2 className="text-[#e0e0e0] text-2xl font-bold">Users</h2>
          <button
            onClick={startAdd}
            className="flex items-center gap-2 px-7 py-4 bg-white text-black text-sm font-bold rounded-[6px]
                       hover:bg-[#ddd] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Add User
          </button>
        </div>

        {users.length === 0 ? (
          <div className="bg-[#1E1E1E] border border-[#2a2a2a] p-20 text-center" style={{ borderRadius: 12 }}>
            <p className="text-[#666] text-sm">No users configured yet.</p>
            <p className="text-[#444] text-xs mt-2">Click &ldquo;Add User&rdquo; to get started.</p>
          </div>
        ) : (
          <>
            {renderGroup('Admins', admins, '#0a3d1f', '#4caf50')}
            {renderGroup('Supervisors', supervisors, '#3d3000', '#ffc107')}
            {renderGroup('PIN-Only', pinOnlyUsers, '#1a1040', '#a855f7')}
          </>
        )}

        <div className="mt-14 text-center">
          <Link href="/privacy" className="text-[#333] text-[11px] no-underline hover:text-[#555]">
            Privacy Policy
          </Link>
        </div>
      </main>
    </div>
  );
}
