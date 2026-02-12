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

export default function UsersPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRole[]>([]);
  const [attractions, setAttractions] = useState<Attraction[]>([]);

  // PIN data per user (loaded alongside users)
  const [pinData, setPinData] = useState<Map<string, SignoffPin>>(new Map());

  // Form state
  const [editing, setEditing] = useState<UserRole | null>(null);
  const [formEmail, setFormEmail] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formRole, setFormRole] = useState<'admin' | 'supervisor'>('supervisor');
  const [formAttractions, setFormAttractions] = useState<string[]>([]);
  const [formPin, setFormPin] = useState('');
  const [formSignoffRoles, setFormSignoffRoles] = useState<SignoffRoleKey[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Form visibility
  const [showForm, setShowForm] = useState(false);

  // Delete confirmation
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

  function startEdit(user: UserRole) {
    setEditing(user);
    setFormEmail(user.email);
    setFormDisplayName(user.display_name || '');
    setFormRole(user.role);
    setFormAttractions(user.allowed_attractions || []);
    const existingPin = pinData.get(user.id);
    setFormPin(existingPin?.pin || '');
    setFormSignoffRoles(existingPin?.signoff_roles || []);
    setFormError('');
    setShowForm(true);
  }

  function startAdd() {
    setEditing(null);
    setFormEmail('');
    setFormDisplayName('');
    setFormRole('supervisor');
    setFormAttractions([]);
    setFormPin('');
    setFormSignoffRoles([]);
    setFormError('');
    setShowForm(true);
  }

  function cancelForm() {
    setEditing(null);
    setFormEmail('');
    setFormDisplayName('');
    setFormRole('supervisor');
    setFormAttractions([]);
    setFormPin('');
    setFormSignoffRoles([]);
    setFormError('');
    setShowForm(false);
  }

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

  async function handleSave() {
    if (!formEmail.trim()) {
      setFormError('Email is required.');
      return;
    }
    setSaving(true);
    setFormError('');

    const email = formEmail.trim().toLowerCase();

    const payload = {
      email,
      display_name: formDisplayName.trim() || null,
      role: formRole,
      allowed_attractions: formRole === 'admin' ? null : formAttractions.length > 0 ? formAttractions : null,
      updated_at: new Date().toISOString(),
    };

    if (editing) {
      const { error } = await supabase
        .from('user_roles')
        .update(payload)
        .eq('id', editing.id);
      if (error) {
        setFormError(error.message);
        setSaving(false);
        return;
      }
    } else {
      // Insert user_roles record — the auth account must be created
      // separately via Supabase Dashboard (Authentication > Users > Add user)
      const { error } = await supabase
        .from('user_roles')
        .insert({ ...payload, created_at: new Date().toISOString() });
      if (error) {
        setFormError(error.message.includes('duplicate') ? 'A user with this email already exists.' : error.message);
        setSaving(false);
        return;
      }
    }

    // Re-fetch to get latest user list (needed for new user ID)
    const { data: freshUsers } = await supabase
      .from('user_roles')
      .select('*')
      .order('created_at', { ascending: true });

    if (freshUsers) setUsers(freshUsers);

    // Upsert PIN data — find the user ID for this email
    const targetUser = (freshUsers || []).find(
      (u: UserRole) => u.email === email
    );

    if (targetUser) {
      const trimmedPin = formPin.trim();
      if (trimmedPin || formSignoffRoles.length > 0) {
        // Upsert pin record
        await supabase.from('signoff_pins').upsert(
          {
            user_id: targetUser.id,
            pin: trimmedPin,
            signoff_roles: formSignoffRoles,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
      } else {
        // No PIN and no roles — remove pin record if it existed
        await supabase.from('signoff_pins').delete().eq('user_id', targetUser.id);
      }
    }

    // Refresh pins
    const { data: freshPins } = await supabase.from('signoff_pins').select('*');
    if (freshPins) {
      const map = new Map<string, SignoffPin>();
      for (const p of freshPins) map.set(p.user_id, p);
      setPinData(map);
    }

    cancelForm();
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    // Delete the user_roles record — the auth account should be removed
    // separately via Supabase Dashboard (Authentication > Users)
    await supabase.from('user_roles').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    await fetchUsers();
  }

  function getAttractionNames(ids: string[] | null): string {
    if (!ids || ids.length === 0) return 'All';
    return ids
      .map((id) => attractions.find((a) => a.id === id)?.name || id.slice(0, 8))
      .join(', ');
  }

  // Only show rides in the attraction picker (supervisors don't manage shows)
  const rides = attractions.filter((a) => a.attraction_type !== 'show');

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
        title={`Remove "${deleteTarget?.email}"?`}
        message="This user will lose all access. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
      {/* Page header */}
      <h2 style={{ color: '#fff', fontSize: 24, fontWeight: 700, marginBottom: 20 }}>Users</h2>

      {/* Create New User — form section card */}
      <div style={{ background: '#111', border: '1px solid #333', borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center justify-center w-7 h-7 bg-white text-black rounded-full text-sm font-bold">+</span>
          <h3 className="text-white text-base font-semibold">{editing ? 'Edit User' : 'Create New User'}</h3>
        </div>

        {formError && (
          <div className="bg-[#2a1010] border border-[#d43518] rounded-md p-3 mb-4">
            <p className="text-[#f0a0a0] text-[13px]">{formError}</p>
          </div>
        )}

        {/* 2-column form grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-[#ccc] text-[13px] font-medium mb-1">
              Email <span className="text-[#d43518]">*</span>
            </label>
            <input
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              disabled={!!editing}
              placeholder="user@example.com"
              className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-[#444] rounded-md text-[#e0e0e0] text-sm
                         placeholder-[#666] focus:outline-none focus:border-[#6ea8fe] focus:shadow-[0_0_0_2px_rgba(110,168,254,0.2)] transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-[#ccc] text-[13px] font-medium mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={formDisplayName}
              onChange={(e) => setFormDisplayName(e.target.value)}
              placeholder="e.g. John S."
              className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-[#444] rounded-md text-[#e0e0e0] text-sm
                         placeholder-[#666] focus:outline-none focus:border-[#6ea8fe] focus:shadow-[0_0_0_2px_rgba(110,168,254,0.2)] transition-colors"
            />
          </div>

          <div>
            <label className="block text-[#ccc] text-[13px] font-medium mb-1">Role</label>
            <select
              value={formRole}
              onChange={(e) => setFormRole(e.target.value as 'admin' | 'supervisor')}
              className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-[#444] rounded-md text-[#e0e0e0] text-sm
                         focus:outline-none focus:border-[#6ea8fe] focus:shadow-[0_0_0_2px_rgba(110,168,254,0.2)] transition-colors"
            >
              <option value="supervisor">Supervisor</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-[#ccc] text-[13px] font-medium mb-1">
              Sign-Off PIN
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={formPin}
              onChange={(e) => setFormPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="4-6 digit PIN"
              className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-[#444] rounded-md text-[#e0e0e0] text-sm
                         placeholder-[#666] focus:outline-none focus:border-[#6ea8fe] focus:shadow-[0_0_0_2px_rgba(110,168,254,0.2)] transition-colors
                         tracking-[0.3em] font-mono"
            />
          </div>
        </div>

        {/* Sign-off roles */}
        <div className="mb-4">
          <label className="block text-[#ccc] text-[13px] font-medium mb-2">
            Sign-Off Roles
          </label>
          <p className="text-[#888] text-[13px] mb-3">
            Which sign-off sections can this user complete?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {ALL_SIGNOFF_ROLES.map((role) => {
              const checked = formSignoffRoles.includes(role);
              return (
                <label
                  key={role}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md cursor-pointer border transition-colors
                    ${checked ? 'bg-[#1a1a1a] border-[#555]' : 'border-[#333] hover:border-[#555]'}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSignoffRole(role)}
                    className="accent-[#6ea8fe] w-4 h-4"
                  />
                  <span className="text-[#ccc] text-[13px]">{SIGNOFF_ROLE_LABELS[role]}</span>
                </label>
              );
            })}
          </div>
        </div>

        {formRole === 'supervisor' && (
          <div className="mb-4">
            <label className="block text-[#ccc] text-[13px] font-medium mb-2">
              Allowed Attractions
            </label>
            <p className="text-[#888] text-[13px] mb-3">
              Select which attractions this supervisor can access. Leave empty for all.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {rides.map((a) => {
                const checked = formAttractions.includes(a.id);
                return (
                  <label
                    key={a.id}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md cursor-pointer border transition-colors
                      ${checked ? 'bg-[#1a1a1a] border-[#555]' : 'border-[#333] hover:border-[#555]'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAttraction(a.id)}
                      className="accent-[#6ea8fe] w-4 h-4"
                    />
                    <span className="text-[#ccc] text-[13px]">{a.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-white text-black text-sm font-semibold rounded-md
                       hover:bg-[#ddd] transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : editing ? 'Update user' : 'Create user'}
          </button>
          {showForm && editing && (
            <button
              onClick={cancelForm}
              className="px-5 py-2.5 bg-transparent border border-[#555] text-[#ccc] text-sm font-semibold
                         hover:border-[#888] hover:text-white rounded-md transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* User list — data table card */}
      <div style={{ background: '#111', border: '1px solid #333', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '20px 20px 0' }}>
          <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>All Users ({users.length})</h3>
        </div>

        {users.length === 0 ? (
          <p className="text-[#666] text-sm px-5 pb-5">No users configured yet.</p>
        ) : (
          (() => {
            const admins = users.filter((u) => u.role === 'admin');
            const supervisors = users.filter((u) => u.role === 'supervisor');

            const renderRows = (group: UserRole[]) =>
              group.map((user) => (
                <tr key={user.id} className="border-b border-[#222] hover:bg-[#1a1a1a] transition-colors">
                  <td className="px-4 py-3 text-sm text-[#e0e0e0]">
                    {user.email}
                    {user.email === userEmail && (
                      <span className="text-[#888] text-xs ml-2">(you)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#888]">
                    {user.display_name || '\u2014'}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#888]">
                    {user.role === 'admin' ? 'All' : getAttractionNames(user.allowed_attractions)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {pinData.get(user.id)?.pin ? (
                      <span className="text-[#4caf50] text-xs font-medium">Set</span>
                    ) : (
                      <span className="text-[#666] text-xs">&mdash;</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#888]">
                    {(() => {
                      const roles = pinData.get(user.id)?.signoff_roles;
                      if (!roles || roles.length === 0) return <span className="text-[#666] text-xs">&mdash;</span>;
                      return (
                        <div className="flex flex-wrap gap-1">
                          {roles.map((r) => (
                            <span key={r} className="inline-block px-1.5 py-0.5 bg-[#1a2a3a] text-[#6ea8fe] text-[10px] font-medium rounded">
                              {SIGNOFF_ROLE_LABELS[r as SignoffRoleKey] || r}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => startEdit(user)}
                        className="px-2.5 py-1 border border-[#555] text-[#ccc] text-xs font-medium rounded
                                   hover:border-[#888] hover:text-white transition-colors"
                      >
                        Edit
                      </button>
                      {user.email !== userEmail && (
                        <button
                          onClick={() => setDeleteTarget(user)}
                          className="px-2.5 py-1 bg-[#d43518] text-white text-xs font-semibold rounded
                                     hover:bg-[#b52d14] transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ));

            const groupHeader = (label: string, count: number, badge: React.ReactNode) => (
              <tr key={`header-${label}`}>
                <td colSpan={6} className="px-4 py-2.5 bg-[#0d0d0d] border-b border-[#333]">
                  <div className="flex items-center gap-2">
                    {badge}
                    <span className="text-[#888] text-xs font-medium">{count} {label}{count !== 1 ? 's' : ''}</span>
                  </div>
                </td>
              </tr>
            );

            return (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#888] uppercase tracking-wider bg-[#1a1a1a] border-b border-[#333]">
                      Email
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#888] uppercase tracking-wider bg-[#1a1a1a] border-b border-[#333]">
                      Display Name
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#888] uppercase tracking-wider bg-[#1a1a1a] border-b border-[#333]">
                      Attractions
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#888] uppercase tracking-wider bg-[#1a1a1a] border-b border-[#333]">
                      PIN
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#888] uppercase tracking-wider bg-[#1a1a1a] border-b border-[#333]">
                      Sign-Off Roles
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-[#888] uppercase tracking-wider bg-[#1a1a1a] border-b border-[#333]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {admins.length > 0 && (
                    <>
                      {groupHeader('Admin', admins.length,
                        <span className="inline-block px-2.5 py-0.5 bg-[#0a3d1f] text-[#4caf50] text-xs font-semibold rounded-full">
                          admin
                        </span>
                      )}
                      {renderRows(admins)}
                    </>
                  )}
                  {supervisors.length > 0 && (
                    <>
                      {groupHeader('Supervisor', supervisors.length,
                        <span className="inline-block px-2.5 py-0.5 bg-[#3d3000] text-[#ffc107] text-xs font-semibold rounded-full">
                          supervisor
                        </span>
                      )}
                      {renderRows(supervisors)}
                    </>
                  )}
                </tbody>
              </table>
            );
          })()
        )}
      </div>
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Link href="/privacy" style={{ color: '#555', fontSize: 11, textDecoration: 'none' }}>
            Privacy Policy
          </Link>
        </div>
      </main>
    </div>
  );
}
