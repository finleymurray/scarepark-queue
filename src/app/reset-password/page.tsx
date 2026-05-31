'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isInvite, setIsInvite] = useState(false);

  useEffect(() => {
    async function init() {
      // Check for token_hash in query params (PKCE / email template approach)
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get('token_hash');
      const type = params.get('type');

      // Check URL hash for token type (legacy redirect approach)
      const hash = window.location.hash;
      const hashIsInvite = hash.includes('type=invite') || hash.includes('type=signup');
      const isInviteFlow = type === 'invite' || type === 'signup' || hashIsInvite;
      setIsInvite(isInviteFlow);

      if (tokenHash && type) {
        // Verify the OTP token hash directly
        const otpType = type === 'invite' ? 'invite' : type === 'recovery' ? 'recovery' : 'email';
        const { error: verifyErr } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType as 'invite' | 'recovery' | 'email',
        });
        if (verifyErr) {
          setVerifyError(verifyErr.message);
        } else {
          setReady(true);
        }
        return;
      }

      // Fallback: listen for auth state change (hash fragment approach)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY' || (isInviteFlow && event === 'SIGNED_IN')) {
          setReady(true);
        }
      });

      // Also check if there's already a session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setReady(true);
      }

      return () => subscription.unsubscribe();
    }
    init();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push('/login'), 2000);
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    background: '#000000',
    border: '1px solid #2a2a2a',
    borderRadius: 8,
    color: '#F1F5F9',
    fontSize: 14,
    outline: 'none',
  };

  if (!ready) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#000000', padding: '0 24px' }}>
        <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
          <Image
            src="/logo-control.png"
            alt="CoreLink"
            width={40}
            height={40}
            priority
            style={{ width: 40, height: 'auto', marginBottom: 24, display: 'block', margin: '0 auto 24px' }}
          />
          {verifyError ? (
            <div style={{ background: '#111111', border: '1px solid #2a2a2a', borderRadius: 12, padding: 28 }}>
              <p style={{ color: '#EF4444', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Link expired or invalid</p>
              <p style={{ color: '#475569', fontSize: 13, marginBottom: 16 }}>{verifyError}</p>
              <a href="/login" style={{ color: '#3B82F6', fontSize: 14, textDecoration: 'none' }}>Back to sign in</a>
            </div>
          ) : (
            <p style={{ color: '#475569', fontSize: 14 }}>Verifying link...</p>
          )}
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#000000', padding: '0 24px' }}>
        <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
          <Image
            src="/logo-control.png"
            alt="CoreLink"
            width={40}
            height={40}
            priority
            style={{ width: 40, height: 'auto', marginBottom: 24, display: 'block', margin: '0 auto 24px' }}
          />
          <div style={{ background: '#111111', border: '1px solid #2a2a2a', borderRadius: 12, padding: 28 }}>
            <p style={{ color: '#22C55E', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Password updated</p>
            <p style={{ color: '#475569', fontSize: 13 }}>Redirecting to sign in...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#000000', padding: '0 24px' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <Image
            src="/logo-control.png"
            alt="CoreLink"
            width={40}
            height={40}
            priority
            style={{ width: 40, height: 'auto', marginBottom: 16 }}
          />
          <h1 style={{ color: '#F1F5F9', fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>CoreLink</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Operations Platform</p>
        </div>

        <form onSubmit={handleSubmit} style={{ background: '#111111', border: '1px solid #2a2a2a', borderRadius: 12, padding: 28 }}>
          <h2 style={{ color: '#F1F5F9', fontSize: 16, fontWeight: 700, marginBottom: 20 }}>
            {isInvite ? 'Set your password' : 'Set new password'}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="At least 6 characters"
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = '#3B82F6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)'; }}
                onBlur={(e) => { e.target.style.borderColor = '#2a2a2a'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Confirm Password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="Re-enter password"
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = '#3B82F6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)'; }}
                onBlur={(e) => { e.target.style.borderColor = '#2a2a2a'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
          </div>

          {error && (
            <p style={{ color: '#EF4444', fontSize: 13, marginBottom: 16 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: '#2563EB',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 8,
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.5 : 1,
            }}
          >
            {saving ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
