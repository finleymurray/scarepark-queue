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
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="text-white/40 text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-black px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <Image
            src="/logo.png"
            alt="Immersive Core"
            width={64}
            height={64}
            className="mb-4"
            priority
          />
          <h1 className="text-white text-xl font-semibold tracking-tight mb-1">Sign-Off</h1>
          <p className="text-[#666] text-sm">Sign in to access the sign-off system</p>
        </div>

        <form onSubmit={handleSubmit} style={{ background: '#1E1E1E', border: '1px solid #2a2a2a', borderRadius: 14, padding: 32 }}>
          {error && (
            <div className="bg-[#2a1010] border border-[#d43518] rounded-[6px] px-3 py-2.5 mb-5">
              <p className="text-[#f0a0a0] text-sm text-center">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-[#888] text-xs font-medium mb-1.5 uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@immersivecore.network"
                className="w-full px-3 py-3 bg-[#111] border border-[#333] rounded-[8px] text-white text-sm
                           placeholder-[#555] focus:outline-none focus:border-[#555] focus:bg-[#161616] transition-colors"
              />
            </div>
            <div>
              <label className="block text-[#888] text-xs font-medium mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-3 py-3 bg-[#111] border border-[#333] rounded-[8px] text-white text-sm
                           placeholder-[#555] focus:outline-none focus:border-[#555] focus:bg-[#161616] transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-3 bg-white text-black text-sm font-semibold rounded-[8px]
                       hover:bg-[#e0e0e0] active:bg-[#ccc] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
