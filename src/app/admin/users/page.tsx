'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { checkAuth } from '@/lib/auth';
import AdminNav from '@/components/AdminNav';
import { ALL_SIGNOFF_ROLES, SIGNOFF_ROLE_LABELS } from '@/lib/signoff';
import type { Attraction, UserRole, SignoffPin, SignoffRoleKey } from '@/types/database';
import { surface, border, text as textTok, accents, radius, primaryButton } from '@/lib/theme';
import { useToasts, ToastStack } from '@/components/ui/Toast';

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
      <div className="bg-[#101318] border border-[#23262E] p-6 w-full max-w-[400px] rounded-xl">
        <p className="text-[#F8FAFC] text-sm font-semibold mb-1.5">{title}</p>
        <p className="text-[#94A3B8] text-sm mb-5">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-[#2E3543] text-[#94A3B8] hover:border-[#475569] hover:text-[#F8FAFC]
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

  const inputStyle = {
    width: '100%', padding: '10px 14px',
    background: surface.control, border: `1px solid ${border.strong}`, borderRadius: 8,
    color: textTok.primary, fontSize: 14, outline: 'none',
  } as const;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', padding: '16px', overflowY: 'auto' }}>
      <div style={{ background: surface.card, border: `1px solid ${border.default}`, borderRadius: radius.xl, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0' }}>
          <h3 style={{ color: textTok.primary, fontSize: 18, fontWeight: 700, margin: 0 }}>
            {editing ? 'Edit User' : 'Add User'}
          </h3>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textTok.muted, padding: 4, display: 'flex', borderRadius: 6 }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M5 5L13 13M13 5L5 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {formError && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px' }}>
              <p style={{ color: '#FCA5A5', fontSize: 13, margin: 0 }}>{formError}</p>
            </div>
          )}

          {/* ── User type toggle ── */}
          {!editing && (
            <div>
              <p style={{ color: textTok.muted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>User Type</p>
              <div style={{ display: 'flex', background: surface.control, border: `1px solid ${border.strong}`, borderRadius: 10, padding: 4, gap: 4 }}>
                {[
                  { value: false, label: 'Email User', desc: 'Can log into Field Control & Admin' },
                  { value: true,  label: 'PIN Only',   desc: 'Sign-off only, no app login' },
                ].map(({ value, label, desc }) => (
                  <button key={label} onClick={() => setFormPinOnly(value)}
                    style={{
                      flex: 1, padding: '10px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', textAlign: 'left',
                      background: formPinOnly === value ? surface.raised : 'transparent',
                      boxShadow: formPinOnly === value ? '0 1px 3px rgba(0,0,0,0.5)' : 'none',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div style={{ color: formPinOnly === value ? textTok.primary : textTok.muted, fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{label}</div>
                    <div style={{ color: formPinOnly === value ? textTok.muted : textTok.faint, fontSize: 11 }}>{desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Basic info ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ color: textTok.muted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Basic Info</p>

            {!formPinOnly && (
              <div>
                <label style={{ display: 'block', color: textTok.secondary, fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Email</label>
                <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)}
                  disabled={!!editing} placeholder="user@example.com"
                  style={{ ...inputStyle, opacity: editing ? 0.4 : 1 }}
                  onFocus={(e) => { e.target.style.borderColor = accents.admin.base; e.target.style.boxShadow = `0 0 0 3px ${accents.admin.soft}`; }}
                  onBlur={(e) => { e.target.style.borderColor = border.strong; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', color: textTok.secondary, fontSize: 12, fontWeight: 500, marginBottom: 6 }}>Display Name</label>
              <input type="text" value={formDisplayName} onChange={(e) => setFormDisplayName(e.target.value)}
                placeholder="e.g. Jane S." style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = accents.admin.base; e.target.style.boxShadow = `0 0 0 3px ${accents.admin.soft}`; }}
                onBlur={(e) => { e.target.style.borderColor = border.strong; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {!formPinOnly && (
              <div>
                <label style={{ display: 'block', color: textTok.secondary, fontSize: 12, fontWeight: 500, marginBottom: 6 }}>App Role</label>
                <div style={{ display: 'flex', background: surface.control, border: `1px solid ${border.strong}`, borderRadius: 8, padding: 4, gap: 4 }}>
                  {(['supervisor', 'admin'] as const).map((r) => (
                    <button key={r} onClick={() => setFormRole(r)}
                      style={{
                        flex: 1, padding: '9px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                        fontSize: 13, fontWeight: 600, textTransform: 'capitalize',
                        background: formRole === r ? (r === 'admin' ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)') : 'transparent',
                        color: formRole === r ? (r === 'admin' ? '#F87171' : '#60A5FA') : textTok.muted,
                        transition: 'all 0.15s',
                      }}>
                      {r === 'supervisor' ? 'Supervisor' : 'Admin'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ height: 1, background: border.divider }} />

          {/* ── Sign-off PIN & Roles ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ color: textTok.muted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Sign-Off</p>

            <div>
              <label style={{ display: 'block', color: textTok.secondary, fontSize: 12, fontWeight: 500, marginBottom: 6 }}>4-Digit PIN</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={4}
                  value={formPin} onChange={(e) => setFormPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="——"
                  style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 22, fontWeight: 700, letterSpacing: '0.5em', textAlign: 'center', paddingLeft: 0 }}
                  onFocus={(e) => { e.target.style.borderColor = accents.admin.base; e.target.style.boxShadow = `0 0 0 3px ${accents.admin.soft}`; }}
                  onBlur={(e) => { e.target.style.borderColor = border.strong; e.target.style.boxShadow = 'none'; }}
                />
                <button type="button" onClick={() => setFormPin(String(Math.floor(1000 + Math.random() * 9000)))}
                  style={{ padding: '10px 16px', background: surface.control, border: `1px solid ${border.strong}`, borderRadius: 8, color: textTok.secondary, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Generate
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', color: textTok.secondary, fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Sign-Off Roles</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {ALL_SIGNOFF_ROLES.map((role) => {
                  const checked = formSignoffRoles.includes(role);
                  return (
                    <button key={role} onClick={() => toggleSignoffRole(role)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                        background: checked ? 'rgba(34,197,94,0.08)' : surface.control,
                        border: `1px solid ${checked ? 'rgba(34,197,94,0.25)' : border.strong}`,
                        borderRadius: 8, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                      }}>
                      <div style={{
                        width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: checked ? '#22C55E' : 'transparent',
                        border: checked ? 'none' : `1.5px solid ${border.strong}`,
                      }}>
                        {checked && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 500, color: checked ? '#86EFAC' : textTok.secondary }}>{SIGNOFF_ROLE_LABELS[role]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Allowed attractions ── */}
          {(formRole === 'supervisor' || formPinOnly) && (
            <>
              <div style={{ height: 1, background: border.divider }} />
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                  <p style={{ color: textTok.muted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Allowed Attractions</p>
                  <span style={{ color: textTok.faint, fontSize: 11 }}>Leave empty for all</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {rides.map((a) => {
                    const checked = formAttractions.includes(a.id);
                    return (
                      <button key={a.id} onClick={() => toggleAttraction(a.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                          background: checked ? 'rgba(59,130,246,0.08)' : surface.control,
                          border: `1px solid ${checked ? 'rgba(59,130,246,0.25)' : border.strong}`,
                          borderRadius: 8, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                        }}>
                        <div style={{
                          width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: checked ? '#3B82F6' : 'transparent',
                          border: checked ? 'none' : `1.5px solid ${border.strong}`,
                        }}>
                          {checked && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 500, color: checked ? '#93C5FD' : textTok.secondary }}>{a.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, padding: '16px 24px', borderTop: `1px solid ${border.divider}` }}>
          <button onClick={onCancel}
            style={{ flex: 1, padding: '11px 0', background: 'transparent', border: `1px solid ${border.strong}`, borderRadius: 8, color: textTok.secondary, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            style={{ ...primaryButton('admin'), flex: 2, padding: '11px 0', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, transition: 'opacity 0.15s' }}>
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create User'}
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
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<UserRole | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRole | null>(null);
  // PIN reveal state: set of user IDs with PIN visible
  const [revealedPins, setRevealedPins] = useState<Set<string>>(new Set());
  const { toasts, pushToast } = useToasts();

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
        pushToast('error', 'Failed to update user');
        return 'Failed to update user. Please try again.';
      }
    } else {
      const { error } = await supabase
        .from('user_roles')
        .insert({ ...payload, created_at: new Date().toISOString() });
      if (error) {
        if (process.env.NODE_ENV === 'development') console.error('User create error:', error);
        pushToast('error', 'Failed to create user');
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
        const { error: pinError } = await supabase.from('signoff_pins').upsert(
          {
            user_id: targetUser.id,
            pin: trimmedPin,
            signoff_roles: data.signoffRoles,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
        if (pinError) {
          if (process.env.NODE_ENV === 'development') console.error('PIN save error:', pinError);
          pushToast('error', 'User saved, but the sign-off PIN failed to save');
        }
      } else {
        const { error: pinDeleteError } = await supabase.from('signoff_pins').delete().eq('user_id', targetUser.id);
        if (pinDeleteError) {
          if (process.env.NODE_ENV === 'development') console.error('PIN delete error:', pinDeleteError);
          pushToast('error', 'User saved, but the old sign-off PIN failed to clear');
        }
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
    const { error } = await supabase.from('user_roles').delete().eq('id', deleteTarget.id);
    if (error) {
      if (process.env.NODE_ENV === 'development') console.error('User delete error:', error);
      pushToast('error', 'Failed to delete user');
    }
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
    const tabMatch = activeTab === 'all' ? true
      : activeTab === 'admin' ? (u.role === 'admin' && !isPinOnlyUser(u))
      : activeTab === 'supervisor' ? (u.role === 'supervisor' && !isPinOnlyUser(u))
      : isPinOnlyUser(u);

    if (!tabMatch) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const pin = pinData.get(u.id);
      return (
        (u.display_name || '').toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (pin?.signoff_roles || []).some((r) => r.toLowerCase().includes(q))
      );
    }

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
      <div className="flex h-screen items-center justify-center bg-[#0A0B0E]">
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
        ? { bg: 'rgba(100,100,100,0.15)', color: textTok.secondary, border: 'rgba(100,100,100,0.3)' }
        : { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: 'rgba(59,130,246,0.3)' };

    const roleBadge = user.role === 'admin' && !pinOnly
      ? { bg: 'rgba(220,38,38,0.1)', color: '#f87171', label: 'Admin' }
      : pinOnly
        ? { bg: 'rgba(100,100,100,0.1)', color: textTok.secondary, label: 'PIN Only' }
        : { bg: 'rgba(59,130,246,0.1)', color: '#60a5fa', label: 'Supervisor' };

    return (
      <div
        key={user.id}
        style={{ background: surface.card, border: `1px solid ${border.divider}`, borderRadius: radius.md, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}
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
            <span style={{ color: textTok.primary, fontSize: 14, fontWeight: 600 }}>
              {user.display_name || (pinOnly ? 'PIN User' : user.email.split('@')[0])}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', padding: '2px 7px', borderRadius: 4, background: roleBadge.bg, color: roleBadge.color }}>
              {roleBadge.label}
            </span>
            {isYou && (
              <span style={{ fontSize: 10, padding: '2px 6px', background: surface.raised, border: `1px solid ${border.strong}`, color: textTok.secondary, borderRadius: 4, fontWeight: 500 }}>you</span>
            )}
          </div>
          {/* Row 2: email / sign-off roles / attractions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            {!pinOnly && (
              <span style={{ color: textTok.secondary, fontSize: 12 }}>{user.email}</span>
            )}
            {pin && pin.signoff_roles && pin.signoff_roles.length > 0 && (
              <span style={{ color: textTok.secondary, fontSize: 12 }}>
                {pin.signoff_roles.map((r) => SIGNOFF_ROLE_LABELS[r as SignoffRoleKey] || r).join(' · ')}
              </span>
            )}
            {user.role !== 'admin' && (
              <span style={{ color: textTok.muted, fontSize: 12 }}>
                {getAttractionNames(user.allowed_attractions)}
              </span>
            )}
          </div>
        </div>

        {/* PIN reveal — always visible */}
        {pin?.pin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 13, color: textTok.secondary, letterSpacing: '0.2em', minWidth: 40, textAlign: 'center' }}>
              {pinRevealed ? pin.pin : '••••'}
            </span>
            <button
              onClick={() => togglePinReveal(user.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: textTok.secondary, padding: 2, display: 'flex', alignItems: 'center' }}
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
            className="px-2.5 py-1 text-[12px] font-medium text-[#94A3B8] hover:text-[#F8FAFC] transition-colors rounded"
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
    <div className="min-h-screen bg-[#0A0B0E]">
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
        <div className="flex items-center justify-between mb-6 gap-4">
          <h2 className="text-[#F8FAFC] text-2xl font-bold flex-shrink-0">Users</h2>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="9" cy="9" r="7"/><path d="M16 16l-3.5-3.5"/>
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email…"
              style={{
                width: '100%', paddingLeft: 32, paddingRight: searchQuery ? 32 : 12,
                paddingTop: 8, paddingBottom: 8,
                background: surface.control, border: `1px solid ${border.strong}`, borderRadius: 8,
                color: textTok.primary, fontSize: 13, outline: 'none',
              }}
              onFocus={(e) => { e.target.style.borderColor = accents.admin.base; }}
              onBlur={(e) => { e.target.style.borderColor = border.strong; }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: textTok.muted, cursor: 'pointer', padding: 2, display: 'flex' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            )}
          </div>
          <button
            onClick={startAdd}
            style={{ ...primaryButton('admin'), display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', fontSize: 13, fontWeight: 700, flexShrink: 0, boxShadow: '0 1px 3px rgba(185,28,28,0.3)', letterSpacing: '-0.01em' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = accents.admin.base; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = accents.admin.strong; }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Add User
          </button>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, background: surface.card, border: `1px solid ${border.divider}`, borderRadius: radius.md, padding: 4 }}>
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
                background: activeTab === tab.key ? surface.raised : 'transparent',
                color: activeTab === tab.key ? textTok.primary : textTok.secondary,
                transition: 'background 0.15s, color 0.15s',
                boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
              }}
            >
              {tab.label}
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                background: activeTab === tab.key ? accents.admin.soft : 'rgba(255,255,255,0.05)',
                color: activeTab === tab.key ? accents.admin.text : textTok.muted,
              }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* User list */}
        {users.length === 0 ? (
          <div className="bg-[#101318] border border-[#23262E] p-16 text-center rounded-xl">
            <p className="text-[#94A3B8] text-sm">No users configured yet.</p>
            <p className="text-[#64748B] text-xs mt-2">Click &ldquo;Add User&rdquo; to get started.</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-[#101318] border border-[#23262E] p-12 text-center rounded-xl">
            <p className="text-[#94A3B8] text-sm">No users in this category.</p>
          </div>
        ) : (
          <div style={{ border: `1px solid ${border.divider}`, borderRadius: 12, overflow: 'hidden' }}>
            {filteredUsers.map((user, idx) => (
              <div key={user.id} style={{ borderTop: idx === 0 ? 'none' : `1px solid ${border.divider}` }}>
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

      <ToastStack toasts={toasts} />
    </div>
  );
}
