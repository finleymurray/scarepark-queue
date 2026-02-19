'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Monitors Supabase realtime connection health.
 * If the connection drops for longer than `maxDowntime` ms, reloads the page.
 * Also reloads when the browser comes back online if Supabase hasn't reconnected.
 *
 * Note: Screen heartbeats are now handled by useScreenIdentity (REST polling).
 * This hook only monitors connection status for auto-recovery.
 *
 * @param _pageName  Page identifier (kept for API compatibility, not used internally)
 * @param options    maxDowntime (default 30s)
 */
export function useConnectionHealth(
  _pageName: string,
  options?: { maxDowntime?: number },
) {
  const maxDowntime = options?.maxDowntime ?? 30_000;
  const disconnectedAtRef = useRef<number | null>(null);

  useEffect(() => {
    let checkInterval: ReturnType<typeof setInterval>;

    function checkConnection() {
      const channels = supabase.getChannels();
      // If we have channels but none are joined/subscribed, connection is likely down
      const allDisconnected =
        channels.length > 0 &&
        channels.every(
          (ch) => ch.state === 'closed' || ch.state === 'errored',
        );

      if (allDisconnected) {
        if (!disconnectedAtRef.current) {
          disconnectedAtRef.current = Date.now();
        } else if (Date.now() - disconnectedAtRef.current > maxDowntime) {
          // Connection has been down too long — reload
          window.location.reload();
        }
      } else {
        // Connection is healthy — reset timer
        disconnectedAtRef.current = null;
      }
    }

    // Also reload if we detect the browser went offline and came back
    function handleOnline() {
      // Give Supabase a moment to reconnect, then reload if it hasn't
      setTimeout(() => {
        const channels = supabase.getChannels();
        const allDisconnected =
          channels.length > 0 &&
          channels.every(
            (ch) => ch.state === 'closed' || ch.state === 'errored',
          );
        if (allDisconnected) {
          window.location.reload();
        }
      }, 5000);
    }

    checkInterval = setInterval(checkConnection, 5000);
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(checkInterval);
      window.removeEventListener('online', handleOnline);
    };
  }, [maxDowntime]);
}
