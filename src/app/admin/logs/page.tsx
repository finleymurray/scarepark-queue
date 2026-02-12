'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkAuth } from '@/lib/auth';
import AdminNav from '@/components/AdminNav';
import type { Attraction, AuditLog, AuditActionType } from '@/types/database';

const PAGE_SIZE = 100;

const ACTION_LABELS: Record<string, string> = {
  queue_time_change: 'Queue Time',
  status_change: 'Status',
  throughput_entry: 'Throughput',
  show_time_added: 'Time Added',
  show_time_removed: 'Time Removed',
  show_time_change: 'Show Time',
  attraction_created: 'Created',
  attraction_deleted: 'Deleted',
  signoff_completion: 'Sign-Off',
};

const ACTION_COLORS: Record<string, string> = {
  queue_time_change: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  status_change: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  throughput_entry: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  show_time_added: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  show_time_removed: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  show_time_change: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  attraction_created: 'bg-green-500/20 text-green-400 border-green-500/30',
  attraction_deleted: 'bg-red-500/20 text-red-400 border-red-500/30',
  signoff_completion: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
};

/* ── Clear Test Data Modal ── */
const CLEAR_DATA_TABLES = [
  { key: 'attraction_history', label: 'Wait Time History', dateCol: 'recorded_at', isTimestamp: true },
  { key: 'throughput_logs', label: 'Throughput Logs', dateCol: 'log_date', isTimestamp: false },
  { key: 'attraction_status_logs', label: 'Status Change Logs', dateCol: 'changed_at', isTimestamp: true },
  { key: 'audit_logs', label: 'Audit Logs', dateCol: 'created_at', isTimestamp: true },
  { key: 'signoff_completions', label: 'Sign-Off Completions', dateCol: 'sign_date', isTimestamp: false },
] as const;

function ClearDataModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [clearDate, setClearDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [confirmText, setConfirmText] = useState('');
  const [clearing, setClearing] = useState(false);
  const [result, setResult] = useState<{ table: string; deleted: number }[] | null>(null);

  useEffect(() => {
    if (open) {
      setClearDate(new Date().toISOString().split('T')[0]);
      setSelectedTables(new Set());
      setConfirmText('');
      setClearing(false);
      setResult(null);
    }
  }, [open]);

  if (!open) return null;

  function toggleTable(key: string) {
    setSelectedTables((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    if (selectedTables.size === CLEAR_DATA_TABLES.length) {
      setSelectedTables(new Set());
    } else {
      setSelectedTables(new Set(CLEAR_DATA_TABLES.map((t) => t.key)));
    }
  }

  const canConfirm = selectedTables.size > 0 && confirmText === 'DELETE' && !clearing;

  async function handleClear() {
    if (!canConfirm) return;
    setClearing(true);
    const results: { table: string; deleted: number }[] = [];

    for (const table of CLEAR_DATA_TABLES) {
      if (!selectedTables.has(table.key)) continue;

      let countQuery;
      if (table.isTimestamp) {
        const start = `${clearDate}T00:00:00`;
        const end = `${clearDate}T23:59:59`;
        countQuery = supabase
          .from(table.key)
          .select('id', { count: 'exact', head: true })
          .gte(table.dateCol, start)
          .lte(table.dateCol, end);
      } else {
        countQuery = supabase
          .from(table.key)
          .select('id', { count: 'exact', head: true })
          .eq(table.dateCol, clearDate);
      }

      const { count } = await countQuery;
      const rowCount = count ?? 0;

      if (rowCount > 0) {
        let deleteQuery;
        if (table.isTimestamp) {
          const start = `${clearDate}T00:00:00`;
          const end = `${clearDate}T23:59:59`;
          deleteQuery = supabase
            .from(table.key)
            .delete()
            .gte(table.dateCol, start)
            .lte(table.dateCol, end);
        } else {
          deleteQuery = supabase
            .from(table.key)
            .delete()
            .eq(table.dateCol, clearDate);
        }

        const { error } = await deleteQuery;
        results.push({
          table: table.label,
          deleted: error ? -1 : rowCount,
        });
      } else {
        results.push({ table: table.label, deleted: 0 });
      }
    }

    setResult(results);
    setClearing(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div style={{ background: '#1a1a1a', border: '1px solid #444', borderRadius: 8, padding: 24, maxWidth: 520, width: '100%' }}>
        {result ? (
          <>
            <h2 className="text-white text-lg font-bold mb-4">Data Cleared</h2>
            <div className="space-y-2 mb-6">
              {result.map((r) => (
                <div key={r.table} className="flex justify-between text-sm">
                  <span className="text-[#888]">{r.table}</span>
                  <span className={r.deleted >= 0 ? 'text-[#22C55E] font-medium' : 'text-[#dc3545] font-medium'}>
                    {r.deleted >= 0 ? `${r.deleted} rows deleted` : 'Error'}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={onClose}
              className="w-full px-6 py-3 bg-white text-black font-bold rounded-md text-sm hover:bg-white/90 transition-colors"
            >
              Done
            </button>
          </>
        ) : (
          <>
            <h2 className="text-white text-lg font-bold mb-1">Clear Test Data</h2>
            <p className="text-[#888] text-sm mb-5">
              Permanently delete analytics and sign-off data for a specific date. This cannot be undone.
            </p>

            <div className="mb-4">
              <label className="text-[#888] text-xs font-medium block mb-1.5">Date to clear</label>
              <input
                type="date"
                value={clearDate}
                onChange={(e) => setClearDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#111] border border-[#333] rounded-md text-white text-sm
                           focus:outline-none focus:border-[#dc3545] transition-colors [color-scheme:dark]"
              />
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[#888] text-xs font-medium">Data to delete</label>
                <button onClick={toggleAll} className="text-[#6ea8fe] text-xs hover:text-white transition-colors">
                  {selectedTables.size === CLEAR_DATA_TABLES.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="space-y-1.5">
                {CLEAR_DATA_TABLES.map((table) => (
                  <label
                    key={table.key}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors hover:bg-[#222]"
                    style={{ background: selectedTables.has(table.key) ? '#dc354515' : 'transparent' }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTables.has(table.key)}
                      onChange={() => toggleTable(table.key)}
                      className="accent-[#dc3545] w-4 h-4"
                    />
                    <span className={`text-sm ${selectedTables.has(table.key) ? 'text-white font-medium' : 'text-[#888]'}`}>
                      {table.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {selectedTables.size > 0 && (
              <div className="mb-5">
                <label className="text-[#888] text-xs font-medium block mb-1.5">
                  Type <span className="text-[#dc3545] font-bold">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-3 py-2.5 bg-[#111] border border-[#333] rounded-md text-white text-sm
                             placeholder-white/20 focus:outline-none focus:border-[#dc3545] transition-colors"
                  autoComplete="off"
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-transparent border border-[#333] text-white hover:border-[#555]
                           rounded-md transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleClear}
                disabled={!canConfirm}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  background: canConfirm ? '#dc3545' : '#333',
                  color: canConfirm ? '#fff' : '#666',
                  fontWeight: 700,
                  borderRadius: 6,
                  border: 'none',
                  cursor: canConfirm ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s',
                }}
              >
                {clearing ? 'Clearing...' : `Clear ${selectedTables.size} Table${selectedTables.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export default function LogsPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [filterAttraction, setFilterAttraction] = useState('');
  const [filterType, setFilterType] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showClearData, setShowClearData] = useState(false);

  const fetchLogs = useCallback(async (offset: number, attractionFilter: string, typeFilter: string) => {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (attractionFilter) {
      query = query.eq('attraction_id', attractionFilter);
    }
    if (typeFilter) {
      query = query.eq('action_type', typeFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching logs:', error);
      return { data: [], hasMore: false };
    }
    return { data: data || [], hasMore: (data?.length || 0) === PAGE_SIZE };
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
        .select('id,name,slug,status,wait_time,sort_order,attraction_type,show_times,updated_at')
        .order('sort_order', { ascending: true });

      if (attractionsData) setAttractions(attractionsData);

      const result = await fetchLogs(0, '', '');
      setLogs(result.data);
      setHasMore(result.hasMore);
      setLoading(false);
    }

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function applyFilters(attraction: string, type: string) {
    setFilterAttraction(attraction);
    setFilterType(type);
    setLoading(true);
    const result = await fetchLogs(0, attraction, type);
    setLogs(result.data);
    setHasMore(result.hasMore);
    setLoading(false);
  }

  async function loadMore() {
    setLoadingMore(true);
    const result = await fetchLogs(logs.length, filterAttraction, filterType);
    setLogs((prev) => [...prev, ...result.data]);
    setHasMore(result.hasMore);
    setLoadingMore(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (loading && logs.length === 0) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl font-semibold animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <AdminNav userEmail={userEmail} displayName={displayName} onLogout={handleLogout} />

      <div className="max-w-6xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold mb-6">Audit Logs</h2>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <select
            value={filterAttraction}
            onChange={(e) => applyFilters(e.target.value, filterType)}
            className="bg-[#1a1a1a] border border-[#333] text-white rounded-lg px-4 py-2 text-sm focus:border-white/30 focus:outline-none"
          >
            <option value="">All Attractions</option>
            {attractions.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          <select
            value={filterType}
            onChange={(e) => applyFilters(filterAttraction, e.target.value)}
            className="bg-[#1a1a1a] border border-[#333] text-white rounded-lg px-4 py-2 text-sm focus:border-white/30 focus:outline-none"
          >
            <option value="">All Types</option>
            <option value="queue_time_change">Queue Time</option>
            <option value="status_change">Status Change</option>
            <option value="throughput_entry">Throughput Entry</option>
            <option value="show_time_added">Time Added</option>
            <option value="show_time_removed">Time Removed</option>
            <option value="attraction_created">Created</option>
            <option value="attraction_deleted">Deleted</option>
            <option value="signoff_completion">Sign-Off</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-[#111] border border-[#333] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#333] text-white/50 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">Time</th>
                  <th className="text-left px-4 py-3 font-medium">Attraction</th>
                  <th className="text-left px-4 py-3 font-medium">Action</th>
                  <th className="text-left px-4 py-3 font-medium">Change</th>
                  <th className="text-left px-4 py-3 font-medium">User</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-white/30">
                      No logs found.
                    </td>
                  </tr>
                )}
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-[#222] hover:bg-[#1a1a1a] transition-colors">
                    <td className="px-4 py-3 text-white/60 whitespace-nowrap tabular-nums text-xs">
                      {formatTimestamp(log.created_at)}
                    </td>
                    <td className="px-4 py-3 text-white font-medium">
                      {log.attraction_name}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${ACTION_COLORS[log.action_type] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                        {ACTION_LABELS[log.action_type] || log.action_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/80">
                      {log.old_value !== null && log.new_value !== null ? (
                        <span>
                          <span className="text-white/40">{log.old_value}</span>
                          <span className="text-white/20 mx-1.5">&rarr;</span>
                          <span className="text-white">{log.new_value}</span>
                        </span>
                      ) : log.new_value !== null ? (
                        <span className="text-white">{log.new_value}</span>
                      ) : log.old_value !== null ? (
                        <span className="text-white/40">{log.old_value}</span>
                      ) : (
                        <span className="text-white/20">—</span>
                      )}
                      {log.action_type === 'status_change' && log.details?.includes('Reason:') && (
                        <div className="mt-1">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#f0ad4e]/15 text-[#f0ad4e] border border-[#f0ad4e]/30">
                            {log.details.split('Reason: ')[1]?.split('.')[0]}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/60 text-xs">
                      {log.performed_by}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Load More */}
        {hasMore && (
          <div className="text-center mt-6">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-6 py-2.5 bg-[#1a1a1a] border border-[#333] rounded-lg text-white/70 text-sm font-medium
                         hover:border-white/30 hover:text-white transition-colors disabled:opacity-50"
            >
              {loadingMore ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}

        {/* Clear Test Data — only visible to finley@immersivecore.network */}
        {userEmail === 'finley@immersivecore.network' && (
          <div className="mt-12 pt-6 border-t border-[#222]">
            <button
              onClick={() => setShowClearData(true)}
              className="px-4 py-2.5 bg-transparent border border-[#dc3545]/30 text-[#dc3545] hover:bg-[#dc3545]/10
                         rounded-md text-xs font-medium transition-colors"
            >
              Clear Test Data...
            </button>
          </div>
        )}
      </div>

      <ClearDataModal
        open={showClearData}
        onClose={() => setShowClearData(false)}
      />
    </div>
  );
}
