'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

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

    router.push('/signoff');
  }

  if (checking) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#070E1A' }}>
        <div style={{ color: '#475569', fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#070E1A', padding: '0 24px' }}>
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
          <h1 style={{ color: '#F1F5F9', fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Sign-Off</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>CoreLink Operations Platform</p>
        </div>

        <form onSubmit={handleSubmit} style={{ background: '#0F172A', border: '1px solid #1E3048', borderRadius: 12, padding: 28 }}>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 20 }}>
              <p style={{ color: '#FCA5A5', fontSize: 13, textAlign: 'center' }}>{error}</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@immersivecore.network"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#070E1A',
                  border: '1px solid #1E3048',
                  borderRadius: 8,
                  color: '#F1F5F9',
                  fontSize: 14,
                  outline: 'none',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#F59E0B'; e.target.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.15)'; }}
                onBlur={(e) => { e.target.style.borderColor = '#1E3048'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#070E1A',
                  border: '1px solid #1E3048',
                  borderRadius: 8,
                  color: '#F1F5F9',
                  fontSize: 14,
                  outline: 'none',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#F59E0B'; e.target.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.15)'; }}
                onBlur={(e) => { e.target.style.borderColor = '#1E3048'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '11px 16px',
              background: '#D97706',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 8,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { if (!loading) (e.target as HTMLButtonElement).style.background = '#B45309'; }}
            onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = '#D97706'; }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
