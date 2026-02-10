'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkAuth } from '@/lib/auth';
import AdminNav from '@/components/AdminNav';
import type { Attraction, AuditLog, AuditActionType } from '@/types/database';

const PAGE_SIZE = 100;

const ACTION_LABELS: Record<AuditActionType, string> = {
  queue_time_change: 'Queue Time',
  status_change: 'Status',
  throughput_entry: 'Throughput',
  show_time_change: 'Show Time',
  attraction_created: 'Created',
  attraction_deleted: 'Deleted',
};

const ACTION_COLORS: Record<AuditActionType, string> = {
  queue_time_change: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  status_change: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  throughput_entry: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  show_time_change: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  attraction_created: 'bg-green-500/20 text-green-400 border-green-500/30',
  attraction_deleted: 'bg-red-500/20 text-red-400 border-red-500/30',
};

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
            <option value="show_time_change">Show Time Change</option>
            <option value="attraction_created">Created</option>
            <option value="attraction_deleted">Deleted</option>
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
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${ACTION_COLORS[log.action_type as AuditActionType] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                        {ACTION_LABELS[log.action_type as AuditActionType] || log.action_type}
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
                      ) : (
                        <span className="text-white/20">—</span>
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
      </div>
    </div>
  );
}
