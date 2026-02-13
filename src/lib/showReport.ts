import { supabase } from './supabase';
import { getAllStatusLogs } from './statusLog';
import { logAudit } from './audit';
import type {
  AttractionStatusLog,
  ThroughputLog,
  HourlyThroughputSnapshot,
  DelaySnapshot,
  ShowReport,
} from '@/types/database';

/* ── Computation helpers ── */

/**
 * Walk status logs chronologically and accumulate minutes spent in OPEN status.
 * If the attraction has no logs for the day, returns 0.
 */
export function computeOperatingMinutes(
  allLogs: AttractionStatusLog[],
  attractionId: string,
): number {
  const logs = allLogs
    .filter((l) => l.attraction_id === attractionId)
    .sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime());

  if (logs.length === 0) return 0;

  let totalMs = 0;
  let openSince: number | null = null;

  for (const log of logs) {
    const ts = new Date(log.changed_at).getTime();

    // If we were tracking an OPEN period and the status changed away from OPEN
    if (openSince !== null && log.status !== 'OPEN') {
      totalMs += ts - openSince;
      openSince = null;
    }

    // If this log marks a transition TO open
    if (log.status === 'OPEN' && openSince === null) {
      openSince = ts;
    }
  }

  // If still open at end of logs, count up to now
  if (openSince !== null) {
    totalMs += Date.now() - openSince;
  }

  return Math.round(totalMs / 60000);
}

/**
 * Build delay snapshots from status logs for a specific attraction.
 */
export function buildDelaySnapshots(
  allLogs: AttractionStatusLog[],
  attractionId: string,
): DelaySnapshot[] {
  return allLogs
    .filter((l) => l.attraction_id === attractionId && l.status === 'DELAYED')
    .map((l) => {
      const startMs = new Date(l.changed_at).getTime();
      const endMs = l.resolved_at ? new Date(l.resolved_at).getTime() : Date.now();
      const durationMinutes = Math.round((endMs - startMs) / 60000);

      return {
        reason: l.reason,
        notes: l.notes,
        started_at: l.changed_at,
        resolved_at: l.resolved_at,
        duration_minutes: durationMinutes,
      };
    });
}

/**
 * Build hourly throughput snapshot from throughput logs for a specific attraction.
 */
export function buildThroughputSnapshot(
  allLogs: ThroughputLog[],
  attractionId: string,
): HourlyThroughputSnapshot[] {
  return allLogs
    .filter((l) => l.attraction_id === attractionId)
    .sort((a, b) => a.slot_start.localeCompare(b.slot_start))
    .map((l) => ({
      slot_start: l.slot_start,
      slot_end: l.slot_end,
      guest_count: l.guest_count,
    }));
}

/* ── Data fetching ── */

/**
 * Fetch all data needed to auto-populate a show report.
 */
export async function fetchReportData(
  attractionId: string,
  dateStr: string,
): Promise<{
  totalOperatingMinutes: number;
  totalGuests: number;
  hourlyThroughput: HourlyThroughputSnapshot[];
  delays: DelaySnapshot[];
}> {
  // Fetch status logs and throughput logs in parallel
  const [statusLogs, throughputResult] = await Promise.all([
    getAllStatusLogs(dateStr),
    supabase
      .from('throughput_logs')
      .select('*')
      .eq('log_date', dateStr),
  ]);

  const throughputLogs: ThroughputLog[] = throughputResult.data || [];

  const totalOperatingMinutes = computeOperatingMinutes(statusLogs, attractionId);
  const delays = buildDelaySnapshots(statusLogs, attractionId);
  const hourlyThroughput = buildThroughputSnapshot(throughputLogs, attractionId);
  const totalGuests = hourlyThroughput.reduce((sum, s) => sum + s.guest_count, 0);

  return { totalOperatingMinutes, totalGuests, hourlyThroughput, delays };
}

/**
 * Submit (upsert) a show report. Returns success/error status.
 */
export async function submitShowReport(
  report: Omit<ShowReport, 'id' | 'created_at'>,
  attractionName: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('show_reports')
    .upsert(report, { onConflict: 'attraction_id,report_date' });

  if (error) {
    console.error('Show report submit error:', error);
    return { success: false, error: error.message };
  }

  // Log audit
  await logAudit({
    actionType: 'show_report_submission',
    attractionId: report.attraction_id,
    attractionName,
    performedBy: report.submitted_by_name || report.submitted_by_email,
    details: `Show report submitted for ${report.report_date}`,
  });

  return { success: true };
}

/**
 * Fetch an existing report for a given attraction and date.
 */
export async function getExistingReport(
  attractionId: string,
  dateStr: string,
): Promise<ShowReport | null> {
  const { data, error } = await supabase
    .from('show_reports')
    .select('*')
    .eq('attraction_id', attractionId)
    .eq('report_date', dateStr)
    .maybeSingle();

  if (error) {
    console.error('Fetch existing report error:', error);
    return null;
  }

  return data as ShowReport | null;
}
