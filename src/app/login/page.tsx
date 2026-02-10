'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
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
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('*')
          .eq('email', session.user.email)
          .single();

        if (userRole?.role === 'admin') {
          router.replace('/admin');
          return;
        }
        if (userRole?.role === 'supervisor') {
          router.replace('/control');
          return;
        }
      }
      setChecking(false);
    }
    checkExisting();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError('Invalid credentials. Try again.');
      setLoading(false);
      return;
    }

    const { data: userRole } = await supabase
      .from('user_roles')
      .select('*')
      .eq('email', data.session?.user.email)
      .single();

    if (!userRole) {
      setError('Access denied — contact an administrator.');
      setLoading(false);
      return;
    }

    if (userRole.role === 'admin') {
      router.push('/admin');
    } else {
      router.push('/control');
    }
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
          <h2 className="text-white text-lg font-semibold mb-6">Sign in</h2>

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
                placeholder="you@example.com"
                className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-[#444] rounded-md text-white text-sm
                           placeholder-[#666] focus:outline-none focus:border-[#6ea8fe] focus:shadow-[0_0_0_2px_rgba(110,168,254,0.2)] transition-colors"
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
                placeholder="Enter password"
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
            disabled={loading}
            className="w-full mt-6 px-4 py-2.5 bg-white text-black text-sm font-semibold rounded-md
                       hover:bg-[#e0e0e0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Link href="/privacy" style={{ color: '#555', fontSize: 11, textDecoration: 'none' }}>
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
