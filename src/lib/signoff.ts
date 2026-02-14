import { supabase } from './supabase';
import type { SignoffRoleKey, SignoffSection, SignoffCompletion } from '@/types/database';

export const SIGNOFF_ROLE_LABELS: Record<SignoffRoleKey, string> = {
  supervisor: 'Attraction Supervisor',
  show_captain: 'Show Captain',
  construction: 'Construction',
  tech: 'Tech',
  manager: 'Manager / Duty Contact',
};

export const ALL_SIGNOFF_ROLES: SignoffRoleKey[] = [
  'supervisor',
  'show_captain',
  'construction',
  'tech',
  'manager',
];

export interface PinVerifyResult {
  valid: true;
  userName: string;
  userEmail: string;
  signoffRoles: SignoffRoleKey[];
}

export interface PinVerifyFailure {
  valid: false;
  error: string;
}

/** Verify a PIN and return the user info + allowed signoff roles. */
export async function verifyPin(pin: string): Promise<PinVerifyResult | PinVerifyFailure> {
  const { data, error } = await supabase
    .from('signoff_pins')
    .select('signoff_roles, user_roles!inner(display_name, email)')
    .eq('pin', pin)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (process.env.NODE_ENV === 'development') console.error('PIN verify error:', error);
    return { valid: false, error: 'System error. Try again.' };
  }

  if (!data) {
    return { valid: false, error: 'Invalid PIN.' };
  }

  const row = data as unknown as { signoff_roles: SignoffRoleKey[]; user_roles: { display_name: string | null; email: string } };
  const userRoles = row.user_roles;
  const isPinOnly = userRoles.email.endsWith('@signoff.local');

  return {
    valid: true,
    userName: userRoles.display_name || userRoles.email,
    userEmail: isPinOnly ? (userRoles.display_name || 'PIN user') : userRoles.email,
    signoffRoles: row.signoff_roles,
  };
}

export interface SectionSignoffStatus {
  section: SignoffSection;
  completion: SignoffCompletion | null;
}

export interface AttractionSignoffStatus {
  attractionId: string;
  openingSections: SectionSignoffStatus[];
  closingSections: SectionSignoffStatus[];
  openingTotal: number;
  openingCompleted: number;
  closingTotal: number;
  closingCompleted: number;
  isFullySignedOff: boolean;
}

/** Get today's date as YYYY-MM-DD string. */
export function getTodayDateStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Fetch sign-off status for an attraction for today. */
export async function getSignoffStatus(attractionId: string): Promise<AttractionSignoffStatus> {
  const today = getTodayDateStr();

  const [sectionsRes, completionsRes] = await Promise.all([
    supabase
      .from('signoff_sections')
      .select('*')
      .eq('attraction_id', attractionId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('signoff_completions')
      .select('*')
      .eq('attraction_id', attractionId)
      .eq('sign_date', today),
  ]);

  const sections: SignoffSection[] = sectionsRes.data || [];
  const completions: SignoffCompletion[] = completionsRes.data || [];

  const completionMap = new Map<string, SignoffCompletion>();
  for (const c of completions) {
    completionMap.set(c.section_id, c);
  }

  const openingSections: SectionSignoffStatus[] = [];
  const closingSections: SectionSignoffStatus[] = [];

  for (const section of sections) {
    const status: SectionSignoffStatus = {
      section,
      completion: completionMap.get(section.id) || null,
    };
    if (section.phase === 'opening') {
      openingSections.push(status);
    } else {
      closingSections.push(status);
    }
  }

  const openingCompleted = openingSections.filter((s) => s.completion).length;
  const closingCompleted = closingSections.filter((s) => s.completion).length;

  return {
    attractionId,
    openingSections,
    closingSections,
    openingTotal: openingSections.length,
    openingCompleted,
    closingTotal: closingSections.length,
    closingCompleted,
    isFullySignedOff:
      openingSections.length > 0 &&
      openingCompleted === openingSections.length &&
      closingCompleted === closingSections.length,
  };
}

/** Fetch sign-off status for ALL attractions for today (batch). */
export async function getAllSignoffStatuses(attractionIds: string[]): Promise<Map<string, AttractionSignoffStatus>> {
  if (attractionIds.length === 0) return new Map();

  const today = getTodayDateStr();

  const [sectionsRes, completionsRes] = await Promise.all([
    supabase
      .from('signoff_sections')
      .select('*')
      .in('attraction_id', attractionIds)
      .order('sort_order', { ascending: true }),
    supabase
      .from('signoff_completions')
      .select('*')
      .in('attraction_id', attractionIds)
      .eq('sign_date', today),
  ]);

  const sections: SignoffSection[] = sectionsRes.data || [];
  const completions: SignoffCompletion[] = completionsRes.data || [];

  const completionMap = new Map<string, SignoffCompletion>();
  for (const c of completions) {
    completionMap.set(c.section_id, c);
  }

  // Group sections by attraction
  const sectionsByAttraction = new Map<string, SignoffSection[]>();
  for (const s of sections) {
    if (!sectionsByAttraction.has(s.attraction_id)) {
      sectionsByAttraction.set(s.attraction_id, []);
    }
    sectionsByAttraction.get(s.attraction_id)!.push(s);
  }

  const result = new Map<string, AttractionSignoffStatus>();

  for (const aid of attractionIds) {
    const aSections = sectionsByAttraction.get(aid) || [];
    const openingSections: SectionSignoffStatus[] = [];
    const closingSections: SectionSignoffStatus[] = [];

    for (const section of aSections) {
      const status: SectionSignoffStatus = {
        section,
        completion: completionMap.get(section.id) || null,
      };
      if (section.phase === 'opening') {
        openingSections.push(status);
      } else {
        closingSections.push(status);
      }
    }

    const openingCompleted = openingSections.filter((s) => s.completion).length;
    const closingCompleted = closingSections.filter((s) => s.completion).length;

    result.set(aid, {
      attractionId: aid,
      openingSections,
      closingSections,
      openingTotal: openingSections.length,
      openingCompleted,
      closingTotal: closingSections.length,
      closingCompleted,
      isFullySignedOff:
        openingSections.length > 0 &&
        openingCompleted === openingSections.length &&
        closingCompleted === closingSections.length,
    });
  }

  return result;
}
