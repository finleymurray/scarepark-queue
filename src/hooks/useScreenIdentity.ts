'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Screen } from '@/types/database';

const ID_STORAGE_KEY = 'ic-screen-id';
const PATH_STORAGE_KEY = 'ic-last-path';
const POLL_INTERVAL = 30_000;

/**
 * Persistent screen identity hook — polling-first, realtime-optional.
 *
 * Used by every TV page and queue display. If the device was registered
 * via /screen (has ic-screen-id in localStorage), this hook:
 *
 *   1. Heartbeats every 30s via REST (updates last_seen + current_page)
 *   2. Reads assigned_path from the response — if it differs from
 *      the current page, navigates immediately (supports live reassignment)
 *   3. Also subscribes to realtime for instant assignment pickup (bonus)
 *
 * If the device was NOT registered via /screen (no localStorage ID),
 * this hook does nothing — the page works standalone.
 *
 * @param pagePath  The current page path (e.g. '/tv1', '/tv4.5', '/queue/the-bunker')
 */
export function useScreenIdentity(pagePath: string) {
  const screenIdRef = useRef<string | null>(null);

  useEffect(() => {
    const screenId = localStorage.getItem(ID_STORAGE_KEY);
    if (!screenId) return; // Not registered via /screen — do nothing

    screenIdRef.current = screenId;

    function handleAssignment(assignedPath: string | null) {
      if (!assignedPath) return;
      // Only navigate if the assigned path differs from where we are
      if (assignedPath !== pagePath) {
        localStorage.setItem(PATH_STORAGE_KEY, assignedPath);
        window.location.href = assignedPath;
      }
    }

    // Polling heartbeat — REST call, no WebSocket dependency
    async function poll() {
      try {
        const { data, error } = await supabase
          .from('screens')
          .update({
            last_seen: new Date().toISOString(),
            current_page: pagePath,
          })
          .eq('id', screenId)
          .select('assigned_path')
          .single();

        if (error) {
          // Only clear identity if the row is truly gone (PGRST116 = no rows found)
          // Other errors (network, rate limit, etc.) should be silently retried
          if (error.code === 'PGRST116') {
            localStorage.removeItem(ID_STORAGE_KEY);
            localStorage.removeItem('ic-screen-code');
            localStorage.removeItem(PATH_STORAGE_KEY);
            window.location.href = '/screen';
          }
          return;
        }

        if (data) {
          handleAssignment(data.assigned_path);
        }
      } catch {
        // Network error — silently fail, will retry next poll
      }
    }

    // Initial heartbeat immediately
    poll();

    // Poll every 30s
    const interval = setInterval(poll, POLL_INTERVAL);

    // Bonus: realtime subscription for instant assignment pickup
    const channel = supabase
      .channel(`screen-identity-${screenId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'screens',
          filter: `id=eq.${screenId}`,
        },
        (payload) => {
          const updated = payload.new as Screen;
          handleAssignment(updated.assigned_path);
        },
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [pagePath]);
}
