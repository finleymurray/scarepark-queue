'use client';

import type React from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { surface, border, text, accents, radius, primaryButton } from '@/lib/theme';
import { InlineError } from '@/components/ui/Toast';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 12px',
  background: surface.control,
  border: `1px solid ${border.strong}`,
  borderRadius: radius.sm,
  color: text.primary,
  fontSize: 14,
  outline: 'none',
};

export default function ControlLoginPage() {
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
        router.replace('/control');
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

    router.push('/control');
  }

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
            src="/logo-control.png"
            alt="CoreLink"
            width={48}
            height={48}
            priority
            style={{ width: 48, height: 'auto', marginBottom: 16 }}
          />
          <h1 style={{ color: text.primary, fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Control</h1>
          <p style={{ color: text.faint, fontSize: 13, marginTop: 4 }}>CoreLink Operations Platform</p>
        </div>

        <form onSubmit={handleSubmit} style={{ background: surface.card, border: `1px solid ${border.default}`, borderRadius: radius.xl, padding: 28 }}>
          {error && (
            <div style={{ marginBottom: 20 }}>
              <InlineError message={error} />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', color: text.secondary, fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@immersivecore.network"
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = accents.control.base; e.target.style.boxShadow = `0 0 0 3px ${accents.control.soft}`; }}
                onBlur={(e) => { e.target.style.borderColor = border.strong; e.target.style.boxShadow = 'none'; }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: text.secondary, fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = accents.control.base; e.target.style.boxShadow = `0 0 0 3px ${accents.control.soft}`; }}
                onBlur={(e) => { e.target.style.borderColor = border.strong; e.target.style.boxShadow = 'none'; }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...primaryButton('control'),
              width: '100%',
              minHeight: 52,
              padding: '12px 16px',
              fontSize: 14,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { if (!loading) (e.target as HTMLButtonElement).style.background = accents.control.base; }}
            onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = accents.control.strong; }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
