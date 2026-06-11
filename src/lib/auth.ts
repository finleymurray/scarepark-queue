import { supabase } from './supabase';

export type Role = 'admin' | 'supervisor';

export interface AuthResult {
  authenticated: boolean;
  role: Role | null;
  email: string | null;
  displayName: string | null;
  allowedAttractions: string[] | null;
}

const ROLE_CACHE_KEY = 'cc-role-cache';
const ROLE_CACHE_TTL = 5 * 60 * 1000; // 5 min — role changes propagate within this window

interface RoleCache {
  email: string;
  role: Role | null;
  displayName: string | null;
  allowedAttractions: string[] | null;
  at: number;
}

function readRoleCache(email: string): RoleCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(ROLE_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as RoleCache;
    if (cached.email !== email || Date.now() - cached.at > ROLE_CACHE_TTL) return null;
    return cached;
  } catch {
    return null;
  }
}

function writeRoleCache(cache: RoleCache) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(ROLE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // storage full/unavailable — non-fatal
  }
}

/** Clear the cached role — call on sign-out so the next login re-fetches. */
export function clearAuthCache() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(ROLE_CACHE_KEY);
  } catch { /* noop */ }
}

async function fetchUserRole(email: string): Promise<RoleCache> {
  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role,email,allowed_attractions,display_name')
    .eq('email', email)
    .single();

  return {
    email,
    role: (userRole?.role as Role) ?? null,
    displayName: userRole?.display_name ?? null,
    allowedAttractions: userRole?.allowed_attractions ?? null,
    at: Date.now(),
  };
}

export async function checkAuth(): Promise<AuthResult> {
  // getSession() is local (reads the persisted session) — no network cost.
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user?.email) {
    return { authenticated: false, role: null, email: null, displayName: null, allowedAttractions: null };
  }

  const email = session.user.email;

  // The role lookup is the expensive part — a Supabase round-trip on EVERY
  // page load now that navigation is full-page. Serve from a short-TTL
  // session cache and refresh in the background so pages render immediately.
  const cached = readRoleCache(email);
  if (cached) {
    void fetchUserRole(email).then(writeRoleCache).catch(() => {});
    return {
      authenticated: true,
      role: cached.role,
      email,
      displayName: cached.displayName,
      allowedAttractions: cached.allowedAttractions,
    };
  }

  const fresh = await fetchUserRole(email);
  writeRoleCache(fresh);

  return {
    authenticated: true,
    role: fresh.role,
    email,
    displayName: fresh.displayName,
    allowedAttractions: fresh.allowedAttractions,
  };
}
