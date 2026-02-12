import { supabase } from './supabase';
import type { AttractionStatusLog, AttractionStatus, DelayReason } from '@/types/database';

export const DELAY_REASONS: DelayReason[] = [
  'Technical Issue',
  'Guest Action',
  'E-Stop',
  'Weather',
  'Staffing',
  'Other',
];

export async function logStatusChange({
  attractionId,
  status,
  previousStatus,
  reason,
  notes,
  changedBy,
}: {
  attractionId: string;
  status: AttractionStatus;
  previousStatus: AttractionStatus | null;
  reason?: DelayReason | null;
  notes?: string | null;
  changedBy: string;
}): Promise<void> {
  const { error } = await supabase.from('attraction_status_logs').insert({
    attraction_id: attractionId,
    status,
    previous_status: previousStatus,
    reason: reason ?? null,
    notes: notes ?? null,
    changed_by: changedBy,
  });

  if (error) {
    console.error('Status log error:', error);
  }
}

export async function resolveDelay(attractionId: string): Promise<void> {
  const { data, error: fetchError } = await supabase
    .from('attraction_status_logs')
    .select('id')
    .eq('attraction_id', attractionId)
    .eq('status', 'DELAYED')
    .is('resolved_at', null)
    .order('changed_at', { ascending: false })
    .limit(1)
    .single();

  if (fetchError || !data) return;

  const { error: updateError } = await supabase
    .from('attraction_status_logs')
    .update({ resolved_at: new Date().toISOString() })
    .eq('id', data.id);

  if (updateError) {
    console.error('Resolve delay error:', updateError);
  }
}

export async function getAllStatusLogs(
  dateStr: string,
): Promise<AttractionStatusLog[]> {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(`${dateStr}T23:59:59`);

  const { data, error } = await supabase
    .from('attraction_status_logs')
    .select('*')
    .gte('changed_at', start.toISOString())
    .lte('changed_at', end.toISOString())
    .order('changed_at', { ascending: true });

  if (error) {
    console.error('Fetch status logs error:', error);
    return [];
  }
  return data || [];
}
