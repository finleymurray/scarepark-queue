'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
      <div className="panel rounded-xl p-6 w-full max-w-sm">
        <h3 className="text-white text-lg font-bold mb-2">{title}</h3>
        <p className="text-[#888] text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-transparent border border-[#333] text-white hover:border-[#555]
                       rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-[#dc3545] hover:bg-[#c82333] text-white rounded-lg
                       text-sm font-bold transition-colors"
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

    const payload = {
      email: formEmail.trim().toLowerCase(),
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
    cancelForm(); // this also sets showForm to false
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
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
        <div className="text-white/40 text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 sm:p-6">
      <AdminNav userEmail={userEmail} onLogout={handleLogout} />

      <ConfirmModal
        open={!!deleteTarget}
        title={`Remove "${deleteTarget?.email}"?`}
        message="This user will lose all access. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* User list */}
      <div className="panel rounded-xl p-4 sm:p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[#888] text-xs font-medium uppercase tracking-wider">Users</h2>
          <button
            onClick={startAdd}
            className="px-3 py-1.5 bg-white text-black text-xs font-semibold rounded-lg
                       hover:bg-[#e0e0e0] transition-colors"
          >
            + Add User
          </button>
        </div>

        {users.length === 0 ? (
          <p className="text-[#666] text-sm">No users configured yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#333]">
                  <th className="text-left text-[#888] font-medium py-2 pr-4">Email</th>
                  <th className="text-left text-[#888] font-medium py-2 pr-4">Role</th>
                  <th className="text-left text-[#888] font-medium py-2 pr-4">Attractions</th>
                  <th className="text-right text-[#888] font-medium py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-[#222]">
                    <td className="py-3 pr-4">
                      <span className="text-white text-sm">{user.email}</span>
                    </td>
                    <td className="py-3 pr-4">
                      {user.role === 'admin' ? (
                        <span className="px-2 py-0.5 bg-white text-black text-xs font-semibold rounded">
                          Admin
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 border border-[#555] text-[#aaa] text-xs font-medium rounded">
                          Supervisor
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-[#888] text-xs">
                        {user.role === 'admin' ? 'All' : getAttractionNames(user.allowed_attractions)}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => startEdit(user)}
                          className="px-2 py-1 text-[#888] hover:text-white text-xs transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(user)}
                          className="px-2 py-1 text-[#dc3545] hover:text-[#ff4d5e] text-xs transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="panel rounded-xl p-4 sm:p-6">
          <h2 className="text-[#888] text-xs font-medium uppercase tracking-wider mb-4">
            {editing ? 'Edit User' : 'Add User'}
          </h2>

          <div className="space-y-4 max-w-lg">
            <div>
              <label className="block text-[#888] text-xs font-medium mb-1.5 uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                disabled={!!editing}
                placeholder="user@example.com"
                className="w-full px-3 py-2.5 bg-transparent border border-[#444] rounded text-white text-sm
                           placeholder-[#666] focus:outline-none focus:border-[#888] transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-[#888] text-xs font-medium mb-1.5 uppercase tracking-wider">
                Role
              </label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value as 'admin' | 'supervisor')}
                className="w-full px-3 py-2.5 bg-black border border-[#444] rounded text-white text-sm
                           focus:outline-none focus:border-[#888] transition-colors"
              >
                <option value="admin">Admin</option>
                <option value="supervisor">Supervisor</option>
              </select>
            </div>

            {formRole === 'supervisor' && (
              <div>
                <label className="block text-[#888] text-xs font-medium mb-2 uppercase tracking-wider">
                  Allowed Attractions
                </label>
                <p className="text-[#666] text-xs mb-3">
                  Select which attractions this supervisor can access. Leave empty for all.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {rides.map((a) => {
                    const checked = formAttractions.includes(a.id);
                    return (
                      <label
                        key={a.id}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors
                          ${checked ? 'bg-white/[0.05] border border-white/20' : 'border border-[#333] hover:border-[#555]'}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAttraction(a.id)}
                          className="accent-white w-4 h-4"
                        />
                        <span className="text-white text-sm">{a.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {formError && (
              <p className="text-[#dc3545] text-sm">{formError}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 bg-white text-black text-sm font-semibold rounded-lg
                           hover:bg-[#e0e0e0] transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : editing ? 'Update User' : 'Add User'}
              </button>
              <button
                onClick={cancelForm}
                className="px-5 py-2.5 bg-transparent border border-[#333] text-white text-sm
                           hover:border-[#555] rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>

            <p className="text-[#666] text-xs mt-2">
              Users must have a Supabase Auth account to log in. This page manages their role and permissions only.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
