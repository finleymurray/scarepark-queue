'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Screen } from '@/types/database';

const ID_STORAGE_KEY = 'ic-screen-id';
const CODE_STORAGE_KEY = 'ic-screen-code';
const HEARTBEAT_INTERVAL = 30_000;

/**
 * Listens for screen reassignment from the admin panel.
 *
 * No-op when the page wasn't launched via the /screen controller
 * (i.e. when `ic-screen-id` is not in localStorage). This means direct
 * URL access to /tv4 etc. is completely unaffected.
 *
 * When active:
 * - Sends heartbeats to the `screens` table every 30s
 * - Subscribes for assignment changes and navigates if the path changes
 * - Listens for broadcast reload commands
 */
export function useScreenAssignment() {
  const screenIdRef = useRef<string | null>(null);

  useEffect(() => {
    const screenId = localStorage.getItem(ID_STORAGE_KEY);
    if (!screenId) return; // Not launched via screen controller — no-op

    screenIdRef.current = screenId;
    const currentPath = window.location.pathname;

    // ── Heartbeat ──
    const heartbeatInterval = setInterval(async () => {
      const { error } = await supabase
        .from('screens')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', screenId);

      // Row was deleted — clear state and go back to /screen
      if (error) {
        localStorage.removeItem(ID_STORAGE_KEY);
        localStorage.removeItem(CODE_STORAGE_KEY);
        window.location.href = '/screen';
      }
    }, HEARTBEAT_INTERVAL);

    // Send one immediately
    supabase
      .from('screens')
      .update({ last_seen: new Date().toISOString() })
      .eq('id', screenId)
      .then(({ error }) => {
        if (error) {
          localStorage.removeItem(ID_STORAGE_KEY);
          localStorage.removeItem(CODE_STORAGE_KEY);
          window.location.href = '/screen';
        }
      });

    // ── Realtime: assignment changes ──
    const channel = supabase
      .channel(`screen-assign-${screenId}`)
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
          if (updated.assigned_path === null) {
            // Unassigned — go back to registration screen
            window.location.href = '/screen';
          } else if (updated.assigned_path !== currentPath) {
            // Reassigned to a different page
            window.location.href = updated.assigned_path;
          }
        },
      )
      .subscribe();

    // ── Broadcast: reload command ──
    const cmdChannel = supabase
      .channel(`screen-cmd-${screenId}`)
      .on('broadcast', { event: 'reload' }, () => {
        window.location.reload();
      })
      .subscribe();

    return () => {
      clearInterval(heartbeatInterval);
      supabase.removeChannel(channel);
      supabase.removeChannel(cmdChannel);
    };
  }, []);
}
