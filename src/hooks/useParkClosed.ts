'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { ParkSetting, Screen } from '@/types/database';

/**
 * Returns whether THIS screen should black out — true when either the global
 * park_settings.park_closed flag is on, OR this specific device (registered
 * via /screen, id in localStorage) has its own `blackout` flag set. Both are
 * kept live via realtime.
 */
export function useParkClosed(): { parkClosed: boolean } {
  const [globalClosed, setGlobalClosed] = useState(false);
  const [screenClosed, setScreenClosed] = useState(false);
  const channelRef = useRef<string>(`park-closed-${Math.random().toString(36).slice(2, 8)}`);

  // Global park_closed flag
  useEffect(() => {
    async function fetchInitial() {
      const { data } = await supabase
        .from('park_settings')
        .select('key,value')
        .eq('key', 'park_closed')
        .single();
      if (data) setGlobalClosed(data.value === 'true');
    }
    fetchInitial();

    const channel = supabase
      .channel(channelRef.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'park_settings' }, (payload) => {
        const setting = payload.new as ParkSetting;
        if (setting.key === 'park_closed') setGlobalClosed(setting.value === 'true');
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Per-device blackout — only if this device is a registered screen
  useEffect(() => {
    const screenId = typeof window !== 'undefined' ? localStorage.getItem('ic-screen-id') : null;
    if (!screenId) return;

    async function fetchScreen() {
      const { data } = await supabase.from('screens').select('blackout').eq('id', screenId).single();
      if (data) setScreenClosed(data.blackout === true);
    }
    fetchScreen();

    const channel = supabase
      .channel(`screen-blackout-${screenId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'screens', filter: `id=eq.${screenId}` }, (payload) => {
        setScreenClosed((payload.new as Screen).blackout === true);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { parkClosed: globalClosed || screenClosed };
}
