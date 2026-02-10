import { supabase } from './supabase';

export type Role = 'admin' | 'supervisor';

export interface AuthResult {
  authenticated: boolean;
  role: Role | null;
  email: string | null;
  allowedAttractions: string[] | null;
}

export async function checkAuth(): Promise<AuthResult> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return { authenticated: false, role: null, email: null, allowedAttractions: null };
  }

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role,email,allowed_attractions')
    .eq('email', session.user.email)
    .single();

  if (!userRole) {
    return { authenticated: true, role: null, email: session.user.email ?? null, allowedAttractions: null };
  }

  return {
    authenticated: true,
    role: userRole.role as Role,
    email: session.user.email ?? null,
    allowedAttractions: userRole.allowed_attractions,
  };
}
