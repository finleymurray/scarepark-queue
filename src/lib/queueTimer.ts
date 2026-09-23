import { supabase } from './supabase';

export interface QueueTiming {
  id: string;
  attraction_id: string;
  lanyard_code: string;
  log_date: string;
  started_at: string;
  completed_at: string | null;
  duration_secs: number | null;
  started_by: string | null;
  completed_by: string | null;
  voided: boolean;
}

export type ScanResult =
  | { action: 'started'; timing: QueueTiming }
  | { action: 'completed'; timing: QueueTiming }
  | { action: 'duplicate'; timing: QueueTiming }
  | { action: 'error'; message: string };

function todayDateStr(): string {
  return new Date().toISOString().split('T')[0];
}

/** Same-code scans within this window are treated as accidental double-scans. */
const DOUBLE_SCAN_WINDOW_MS = 45_000;

export function normalizeLanyardCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/** Round a duration in seconds to the nearest 5 minutes (0–180). */
export function roundToNearest5(durationSecs: number): number {
  const mins = durationSecs / 60;
  return Math.max(0, Math.min(180, Math.round(mins / 5) * 5));
}

/**
 * One scan handles both directions: no open timing for this lanyard tonight
 * starts one (queue entrance); an existing open timing completes it
 * (attraction entry) and yields the measured queue duration.
 */
export async function scanLanyard(
  attractionId: string,
  rawCode: string,
  scannedBy: string,
): Promise<ScanResult> {
  const code = normalizeLanyardCode(rawCode);
  if (!code) return { action: 'error', message: 'Empty code' };

  const { data: open, error: findError } = await supabase
    .from('queue_timings')
    .select('*')
    .eq('attraction_id', attractionId)
    .eq('lanyard_code', code)
    .eq('log_date', todayDateStr())
    .is('completed_at', null)
    .eq('voided', false)
    .order('started_at', { ascending: false })
    .limit(1);

  if (findError) return { action: 'error', message: 'Lookup failed — check connection' };

  const existing = (open?.[0] as QueueTiming | undefined) ?? null;

  if (existing) {
    const startedMs = new Date(existing.started_at).getTime();
    if (Date.now() - startedMs < DOUBLE_SCAN_WINDOW_MS) {
      return { action: 'duplicate', timing: existing };
    }
    const completedAt = new Date();
    const durationSecs = Math.max(0, Math.round((completedAt.getTime() - startedMs) / 1000));
    const { data: updated, error: updateError } = await supabase
      .from('queue_timings')
      .update({
        completed_at: completedAt.toISOString(),
        duration_secs: durationSecs,
        completed_by: scannedBy,
      })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (updateError || !updated) return { action: 'error', message: 'Failed to complete timing — try again' };
    return { action: 'completed', timing: updated as QueueTiming };
  }

  const { data: inserted, error: insertError } = await supabase
    .from('queue_timings')
    .insert({
      attraction_id: attractionId,
      lanyard_code: code,
      log_date: todayDateStr(),
      started_by: scannedBy,
    })
    .select('*')
    .single();
  if (insertError || !inserted) return { action: 'error', message: 'Failed to start timing — try again' };
  return { action: 'started', timing: inserted as QueueTiming };
}

/** Lanyards currently in the queue tonight (oldest first). */
export async function fetchOpenTimings(attractionId: string): Promise<QueueTiming[]> {
  const { data, error } = await supabase
    .from('queue_timings')
    .select('*')
    .eq('attraction_id', attractionId)
    .eq('log_date', todayDateStr())
    .is('completed_at', null)
    .eq('voided', false)
    .order('started_at', { ascending: true });
  if (error) return [];
  return (data as QueueTiming[]) || [];
}

/** Void a timing (guest left the queue / lost lanyard). */
export async function voidTiming(id: string): Promise<boolean> {
  const { error } = await supabase.from('queue_timings').update({ voided: true }).eq('id', id);
  return !error;
}
