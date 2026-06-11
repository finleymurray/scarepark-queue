'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { surface, border, text as textTok, accents, radius, primaryButton } from '@/lib/theme';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get('next') || null;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkExisting() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        if (nextUrl) { router.replace(nextUrl); return; }
        router.replace('/landing');
        return;
      }
      setChecking(false);
    }
    checkExisting();
  }, [router, nextUrl]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError('Invalid credentials. Try again.');
      setLoading(false);
      return;
    }

    const { data: userRole } = await supabase
      .from('user_roles').select('role').eq('email', data.session?.user.email).single();

    if (!userRole) {
      setError('Access denied — contact an administrator.');
      setLoading(false);
      return;
    }

    window.location.href = nextUrl || '/landing';
  }

  if (checking) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: surface.page }}>
        <div style={{ color: textTok.faint, fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: surface.page, padding: '0 24px' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <Image
            src="/logo-control.png"
            alt="CoreLink"
            width={44}
            height={44}
            priority
            style={{ width: 44, height: 'auto', marginBottom: 16 }}
          />
          <h1 style={{ color: textTok.primary, fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>CoreLink</h1>
          <p style={{ color: textTok.faint, fontSize: 13, marginTop: 4, letterSpacing: '0.02em' }}>Operations Platform</p>
        </div>

        <form onSubmit={handleSubmit} style={{ background: surface.card, border: `1px solid ${border.default}`, borderRadius: radius.xl, padding: 28 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', color: textTok.secondary, fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: surface.control,
                  border: `1px solid ${border.strong}`,
                  borderRadius: 8,
                  color: textTok.primary,
                  fontSize: 14,
                  outline: 'none',
                }}
                onFocus={(e) => { e.target.style.borderColor = accents.control.base; e.target.style.boxShadow = `0 0 0 3px ${accents.control.soft}`; }}
                onBlur={(e) => { e.target.style.borderColor = border.strong; e.target.style.boxShadow = 'none'; }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: textTok.secondary, fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter password"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: surface.control,
                  border: `1px solid ${border.strong}`,
                  borderRadius: 8,
                  color: textTok.primary,
                  fontSize: 14,
                  outline: 'none',
                }}
                onFocus={(e) => { e.target.style.borderColor = accents.control.base; e.target.style.boxShadow = `0 0 0 3px ${accents.control.soft}`; }}
                onBlur={(e) => { e.target.style.borderColor = border.strong; e.target.style.boxShadow = 'none'; }}
              />
            </div>
          </div>

          {error && (
            <p style={{ color: '#EF4444', fontSize: 13, marginBottom: 16 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...primaryButton('control'),
              width: '100%',
              padding: '10px 16px',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { if (!loading) (e.target as HTMLButtonElement).style.background = accents.control.base; }}
            onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = accents.control.strong; }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Link href="/privacy" style={{ color: textTok.faint, fontSize: 11, textDecoration: 'none' }}>
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: surface.page, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: "#374151", fontSize: 14 }}>Loading…</div></div>}>
      <LoginForm />
    </Suspense>
  );
}
