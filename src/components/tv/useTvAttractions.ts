'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Attraction } from '@/types/database';

const ATTRACTION_COLUMNS =
  'id,name,slug,status,wait_time,sort_order,attraction_type,show_times,updated_at,logo_url,bg_url,queue_bg_url,glow_rgb,text_color,text_rgb,fear_rating,tagline';

/**
 * Single attractions fetch + single realtime channel, shared by the TV
 * carousel screens. Returns attractions sorted by sort_order.
 */
export function useTvAttractions(channelName: string) {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const { data, error } = await supabase
        .from('attractions')
        .select(ATTRACTION_COLUMNS)
        .order('sort_order', { ascending: true });
      if (!cancelled && !error && data) setAttractions(data);
      if (!cancelled) setLoading(false);
    }
    init();

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attractions' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setAttractions((prev) =>
              prev
                .map((a) => (a.id === (payload.new as Attraction).id ? { ...a, ...(payload.new as Attraction) } : a))
                .sort((a, b) => a.sort_order - b.sort_order),
            );
          } else if (payload.eventType === 'INSERT') {
            setAttractions((prev) =>
              [...prev, payload.new as Attraction].sort((a, b) => a.sort_order - b.sort_order),
            );
          } else if (payload.eventType === 'DELETE') {
            setAttractions((prev) => prev.filter((a) => a.id !== (payload.old as Attraction).id));
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [channelName]);

  return { attractions, loading };
}
