'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { checkAuth } from '@/lib/auth';
import AdminNav from '@/components/AdminNav';
import type { Attraction, UserRole } from '@/types/database';

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
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRole[]>([]);
  const [attractions, setAttractions] = useState<Attraction[]>([]);

  // Form state
  const [editing, setEditing] = useState<UserRole | null>(null);
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<'admin' | 'supervisor'>('supervisor');
  const [formAttractions, setFormAttractions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Form visibility
  const [showForm, setShowForm] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<UserRole | null>(null);

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase
      .from('user_roles')
      .select('*')
      .order('created_at', { ascending: true });
    if (data) setUsers(data);
  }, []);

  useEffect(() => {
    async function init() {
      const auth = await checkAuth();
      if (!auth.authenticated || auth.role !== 'admin') {
        router.push('/login');
        return;
      }
      setUserEmail(auth.email || '');

      const [usersRes, attractionsRes] = await Promise.all([
        supabase.from('user_roles').select('*').order('created_at', { ascending: true }),
        supabase.from('attractions').select('*').order('sort_order', { ascending: true }),
      ]);

      if (usersRes.data) setUsers(usersRes.data);
      if (attractionsRes.data) setAttractions(attractionsRes.data);
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
    setFormRole(user.role);
    setFormAttractions(user.allowed_attractions || []);
    setFormError('');
    setShowForm(true);
  }

  function startAdd() {
    setEditing(null);
    setFormEmail('');
    setFormRole('supervisor');
    setFormAttractions([]);
    setFormError('');
    setShowForm(true);
  }

  function cancelForm() {
    setEditing(null);
    setFormEmail('');
    setFormRole('supervisor');
    setFormAttractions([]);
    setFormError('');
    setShowForm(false);
  }

  function toggleAttraction(id: string) {
    setFormAttractions((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
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

    await fetchUsers();
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
      <AdminNav userEmail={userEmail} onLogout={handleLogout} />

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

          {!editing && (
            <div className="flex items-center">
              <p className="text-[#888] text-[13px]">
                Auth account must be created via Supabase Dashboard first.
              </p>
            </div>
          )}

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
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#888] uppercase tracking-wider bg-[#1a1a1a] border-b border-[#333]">
                  Email
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#888] uppercase tracking-wider bg-[#1a1a1a] border-b border-[#333]">
                  Role
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#888] uppercase tracking-wider bg-[#1a1a1a] border-b border-[#333]">
                  Attractions
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#888] uppercase tracking-wider bg-[#1a1a1a] border-b border-[#333]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-[#222] hover:bg-[#1a1a1a] transition-colors">
                  <td className="px-4 py-3 text-sm text-[#e0e0e0]">
                    {user.email}
                    {user.email === userEmail && (
                      <span className="text-[#888] text-xs ml-2">(you)</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {user.role === 'admin' ? (
                      <span className="inline-block px-2.5 py-0.5 bg-[#0a3d1f] text-[#4caf50] text-xs font-semibold rounded-full">
                        admin
                      </span>
                    ) : (
                      <span className="inline-block px-2.5 py-0.5 bg-[#3d3000] text-[#ffc107] text-xs font-semibold rounded-full">
                        supervisor
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#888]">
                    {user.role === 'admin' ? 'All' : getAttractionNames(user.allowed_attractions)}
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
              ))}
            </tbody>
          </table>
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
