'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError('Invalid credentials. Try again.');
      setLoading(false);
      return;
    }

    router.push('/admin');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      {/* Background glow effect */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,rgba(139,0,0,0.15),transparent_70%)]" />

      <div className="relative w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-blood-bright text-4xl font-black uppercase tracking-wide mb-2">
            Staff Login
          </h1>
          <p className="text-bone/50 text-sm">Scarepark Queue Management</p>
          <div className="mt-3 mx-auto w-32 h-0.5 bg-gradient-to-r from-transparent via-blood to-transparent" />
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="horror-card rounded-xl p-8 space-y-5">
          <div>
            <label htmlFor="email" className="block text-bone/70 text-sm font-medium mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-black/60 border border-gore rounded-lg text-bone
                         placeholder-bone/30 focus:outline-none focus:border-blood-bright focus:ring-1
                         focus:ring-blood-bright transition-colors"
              placeholder="staff@scarepark.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-bone/70 text-sm font-medium mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-black/60 border border-gore rounded-lg text-bone
                         placeholder-bone/30 focus:outline-none focus:border-blood-bright focus:ring-1
                         focus:ring-blood-bright transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-blood-bright text-sm text-center py-2 px-3 bg-blood/10 rounded-lg border border-blood/30">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blood hover:bg-blood-bright text-bone font-semibold rounded-lg
                       transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                       active:scale-[0.98]"
          >
            {loading ? 'Signing in...' : 'Enter the Control Room'}
          </button>
        </form>
      </div>
    </div>
  );
}
