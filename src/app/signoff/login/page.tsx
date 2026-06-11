'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { surface, border, text, accents, radius, microLabel, card } from '@/lib/theme';
import { InlineError } from '@/components/ui/Toast';

const accent = accents.signoff;

export default function SignoffLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkExisting() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace('/signoff');
        return;
      }
      setChecking(false);
    }
    checkExisting();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError('Invalid credentials. Try again.');
      setLoading(false);
      return;
    }

    window.location.href = '/signoff';
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    background: surface.control,
    border: `1px solid ${border.default}`,
    borderRadius: radius.sm,
    color: text.primary,
    fontSize: 14,
    outline: 'none',
  };

  if (checking) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: surface.page }}>
        <div style={{ color: text.faint, fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: surface.page, padding: '0 24px' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <Image
            src="/logo-signoff.png"
            alt="CoreLink"
            width={48}
            height={48}
            priority
            style={{ width: 48, height: 'auto', marginBottom: 16 }}
          />
          <h1 style={{ color: text.primary, fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Sign-Off</h1>
          <p style={{ color: text.faint, fontSize: 13, marginTop: 4 }}>CoreLink Operations Platform</p>
        </div>

        <form onSubmit={handleSubmit} style={{ ...card(), padding: 28 }}>
          {error && (
            <div style={{ marginBottom: 20 }}>
              <InlineError message={error} />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ ...microLabel, display: 'block', color: text.secondary, fontSize: 11, marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@immersivecore.network"
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = accent.base; e.target.style.boxShadow = `0 0 0 3px ${accent.soft}`; }}
                onBlur={(e) => { e.target.style.borderColor = border.default; e.target.style.boxShadow = 'none'; }}
              />
            </div>
            <div>
              <label style={{ ...microLabel, display: 'block', color: text.secondary, fontSize: 11, marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = accent.base; e.target.style.boxShadow = `0 0 0 3px ${accent.soft}`; }}
                onBlur={(e) => { e.target.style.borderColor = border.default; e.target.style.boxShadow = 'none'; }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '11px 16px',
              background: accent.strong,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: radius.sm,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { if (!loading) (e.target as HTMLButtonElement).style.background = '#B45309'; }}
            onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = accent.strong; }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
