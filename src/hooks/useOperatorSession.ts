'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import type { OperatorSession } from '@/types/database';

/**
 * Tracks the active operator session for an attraction.
 *
 * A session is active when ended_at is null. Sessions are per-attraction and
 * kept in sync across devices via a realtime subscription on operator_sessions.
 *
 * login()/changeOperator() use "takeover" semantics: entering a valid PIN ends
 * any existing active session (ended_reason='takeover') and starts a new one —
 * picking up a shift never requires the previous operator to log out first.
 */
export default function useOperatorSession(attractionId: string | null, attractionName = '') {
  const [session, setSession] = useState<OperatorSession | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('operator_sessions')
      .select('*')
      .eq('attraction_id', id)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setSession((data as OperatorSession) || null);
  }, []);

  useEffect(() => {
    if (!attractionId) {
      setSession(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchSession(attractionId).then(() => {
      if (!cancelled) setLoading(false);
    });

    const channel = supabase
      .channel(`operator-sessions-${attractionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'operator_sessions', filter: `attraction_id=eq.${attractionId}` },
        () => { fetchSession(attractionId); }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [attractionId, fetchSession]);

  /** Verify a PIN, take over the attraction, and start a new session. */
  const login = useCallback(async (pin: string): Promise<boolean> => {
    if (!attractionId) return false;

    const { data, error } = await supabase
      .from('signoff_pins')
      .select('user_id, user_roles!inner(id, display_name, email)')
      .eq('pin', pin)
      .limit(1)
      .maybeSingle();

    if (error || !data) return false;

    const row = data as unknown as {
      user_id: string;
      user_roles: { id: string; display_name: string | null; email: string };
    };
    const operatorName = row.user_roles.display_name || row.user_roles.email;
    const previousOperator = session?.operator_name ?? null;

    // End any existing active session for this attraction (takeover)
    await supabase
      .from('operator_sessions')
      .update({ ended_at: new Date().toISOString(), ended_reason: 'takeover' })
      .eq('attraction_id', attractionId)
      .is('ended_at', null);

    const { data: inserted, error: insertError } = await supabase
      .from('operator_sessions')
      .insert({
        attraction_id: attractionId,
        user_id: row.user_id,
        operator_name: operatorName,
        operator_email: row.user_roles.email,
      })
      .select('*')
      .single();

    if (insertError) return false;
    setSession((inserted as OperatorSession) || null);

    await logAudit({
      actionType: 'operator_login',
      attractionId,
      attractionName,
      performedBy: operatorName,
      oldValue: previousOperator,
      newValue: operatorName,
      details: previousOperator ? `Took over from ${previousOperator}` : 'Signed in as operator',
    });
    return true;
  }, [attractionId, attractionName, session]);

  /** Same takeover semantics as login — swapping who's on the panel. */
  const changeOperator = login;

  /** End the active session (operator going off shift). */
  const endShift = useCallback(async () => {
    if (!session) return;
    await supabase
      .from('operator_sessions')
      .update({ ended_at: new Date().toISOString(), ended_reason: 'logout' })
      .eq('id', session.id);
    await logAudit({
      actionType: 'operator_logout',
      attractionId: session.attraction_id,
      attractionName,
      performedBy: session.operator_name,
      details: 'Ended shift',
    });
    setSession(null);
  }, [session, attractionName]);

  return { session, loading, login, changeOperator, endShift };
}
