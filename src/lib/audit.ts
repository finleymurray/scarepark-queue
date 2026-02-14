import { supabase } from './supabase';
import type { AuditActionType } from '@/types/database';

export async function logAudit({
  actionType,
  attractionId,
  attractionName,
  performedBy,
  oldValue,
  newValue,
  details,
}: {
  actionType: AuditActionType;
  attractionId: string | null;
  attractionName: string;
  performedBy: string;
  oldValue?: string | null;
  newValue?: string | null;
  details?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    action_type: actionType,
    attraction_id: attractionId,
    attraction_name: attractionName,
    performed_by: performedBy,
    old_value: oldValue ?? null,
    new_value: newValue ?? null,
    details: details ?? null,
  });

  if (error) {
    if (process.env.NODE_ENV === 'development') console.error('Audit log error:', error);
  }
}
