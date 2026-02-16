'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Returns a stable device-unique screen ID.
 * Combines the page name (e.g. 'tv4') with a short random device ID
 * persisted in localStorage, so multiple Pis running the same URL
 * each get their own identity (e.g. 'tv4-a3f1', 'tv4-c8b2').
 */
function getUniqueScreenId(pageName: string): string {
  const STORAGE_KEY = 'ic-device-id';
  let deviceId = localStorage.getItem(STORAGE_KEY);
  if (!deviceId) {
    deviceId = Math.random().toString(36).substring(2, 6);
    localStorage.setItem(STORAGE_KEY, deviceId);
  }
  return `${pageName}-${deviceId}`;
}

/**
 * Monitors Supabase realtime connection health.
 * If the connection drops for longer than `maxDowntime` ms, reloads the page.
 * Also sends periodic heartbeat pings to the `screen_heartbeats` table
 * so the admin panel can monitor which screens are online.
 *
 * @param pageName  Page identifier (e.g. 'tv1', 'tv4', 'queue-the-bunker')
 * @param options   maxDowntime (default 30s), heartbeatInterval (default 30s)
 */
export function useConnectionHealth(
  pageName: string,
  options?: { maxDowntime?: number; heartbeatInterval?: number },
) {
  const maxDowntime = options?.maxDowntime ?? 30_000;
  const heartbeatInterval = options?.heartbeatInterval ?? 30_000;
  const disconnectedAtRef = useRef<number | null>(null);

  // Monitor Supabase realtime connection status
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

  // Send periodic heartbeat pings
  useEffect(() => {
    const screenId = getUniqueScreenId(pageName);

    async function sendHeartbeat() {
      try {
        await supabase.from('screen_heartbeats').upsert(
          {
            screen_id: screenId,
            page: pageName,
            last_seen: new Date().toISOString(),
            user_agent: navigator.userAgent,
          },
          { onConflict: 'screen_id' },
        );
      } catch {
        // Silently fail — if we can't send heartbeat, the connection check will handle it
      }
    }

    // Send immediately on mount
    sendHeartbeat();

    const interval = setInterval(sendHeartbeat, heartbeatInterval);
    return () => clearInterval(interval);
  }, [pageName, heartbeatInterval]);
}
