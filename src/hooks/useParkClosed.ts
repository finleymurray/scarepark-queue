'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { ParkSetting } from '@/types/database';

export function useParkClosed(): { parkClosed: boolean } {
  const [parkClosed, setParkClosed] = useState(false);
  const channelRef = useRef<string>(
    `park-closed-${Math.random().toString(36).slice(2, 8)}`
  );

  useEffect(() => {
    async function fetchInitial() {
      const { data } = await supabase
        .from('park_settings')
        .select('key,value')
        .eq('key', 'park_closed')
        .single();

      if (data) {
        setParkClosed(data.value === 'true');
      }
    }

    fetchInitial();

    const channel = supabase
      .channel(channelRef.current)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'park_settings' },
        (payload) => {
          const setting = payload.new as ParkSetting;
          if (setting.key === 'park_closed') {
            setParkClosed(setting.value === 'true');
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { parkClosed };
}
