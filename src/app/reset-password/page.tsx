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

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-black px-6">
        <div className="w-full max-w-sm text-center">
          <Image
            src="/logo.png"
            alt="Immersive Core"
            width={200}
            height={60}
            className="mx-auto mb-6"
            priority
          />
          {verifyError ? (
            <div className="panel p-8">
              <p className="text-[#dc3545] text-lg font-semibold mb-2">Link expired or invalid</p>
              <p className="text-white/40 text-sm mb-4">{verifyError}</p>
              <a href="/login" className="text-[#6ea8fe] text-sm hover:underline">Back to sign in</a>
            </div>
          ) : (
            <p className="text-white/40 text-sm">Verifying link...</p>
          )}
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex h-screen items-center justify-center bg-black px-6">
        <div className="w-full max-w-sm text-center">
          <Image
            src="/logo.png"
            alt="Immersive Core"
            width={200}
            height={60}
            className="mx-auto mb-6"
            priority
          />
          <div className="panel p-8">
            <p className="text-[#22C55E] text-lg font-semibold mb-2">Password updated</p>
            <p className="text-white/40 text-sm">Redirecting to sign in...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-black px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/logo.png"
            alt="Immersive Core"
            width={200}
            height={60}
            className="mb-3"
            priority
          />
          <div className="text-[13px] text-white/70 uppercase tracking-[8px] font-medium">
            Network
          </div>
        </div>

        <form onSubmit={handleSubmit} className="panel p-8">
          <h2 className="text-white text-lg font-semibold mb-6">
            {isInvite ? 'Set your password' : 'Set new password'}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-[#888] text-xs font-medium mb-1.5 uppercase tracking-wider">
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="At least 6 characters"
                className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-[#444] rounded-md text-white text-sm
                           placeholder-[#666] focus:outline-none focus:border-[#6ea8fe] focus:shadow-[0_0_0_2px_rgba(110,168,254,0.2)] transition-colors"
              />
            </div>
            <div>
              <label className="block text-[#888] text-xs font-medium mb-1.5 uppercase tracking-wider">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="Re-enter password"
                className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-[#444] rounded-md text-white text-sm
                           placeholder-[#666] focus:outline-none focus:border-[#6ea8fe] focus:shadow-[0_0_0_2px_rgba(110,168,254,0.2)] transition-colors"
              />
            </div>
          </div>

          {error && (
            <p className="text-[#dc3545] text-sm mt-4">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full mt-6 px-4 py-2.5 bg-white text-black text-sm font-semibold rounded-md
                       hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
