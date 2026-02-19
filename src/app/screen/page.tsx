'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import ElectricHeader from '@/components/ElectricHeader';
import LightningBorder from '@/components/LightningBorder';
import type { Screen } from '@/types/database';

/* ── Constants ── */

const SAFE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 4;
const POLL_INTERVAL = 30_000;
const CODE_STORAGE_KEY = 'ic-screen-code';
const ID_STORAGE_KEY = 'ic-screen-id';
const PATH_STORAGE_KEY = 'ic-last-path';

function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)];
  }
  return code;
}

/* ── Component ── */

/**
 * Screen Registration & Recovery Page
 *
 * This page is the boot target for every Raspberry Pi kiosk.
 * On load it follows this flow:
 *
 *   1. Recovery by hostname (most reliable) — every Pi has a unique
 *      hostname baked in (ic-kiosk-XXXX). If we find a screen row in
 *      Supabase matching this hostname AND it has an assigned_path,
 *      navigate there immediately. This survives localStorage wipes,
 *      power failures, Chromium crashes — everything.
 *
 *   2. Recovery by localStorage — check ic-screen-id / ic-last-path
 *      for faster recovery without a DB round-trip.
 *
 *   3. If neither exists (fresh Pi), register a new row and show the code.
 *
 * Once assigned, the Pi STAYS on its assigned page. The only way to
 * unassign is for an admin to explicitly clear the assignment in the
 * admin panel.
 */
export default function ScreenController() {
  const [code, setCode] = useState<string | null>(null);
  const [screenId, setScreenId] = useState<string | null>(null);
  const [status, setStatus] = useState<'booting' | 'registering' | 'waiting'>('booting');
  const cancelledRef = useRef(false);

  // ── 1. Boot: recover identity or register ──
  useEffect(() => {
    cancelledRef.current = false;

    // Read hostname from URL param (set by kiosk.sh on Raspberry Pi)
    const urlParams = new URLSearchParams(window.location.search);
    const hostnameParam = urlParams.get('hostname');
    if (hostnameParam) localStorage.setItem('ic-screen-hostname', hostnameParam);
    const screenName = hostnameParam || localStorage.getItem('ic-screen-hostname') || null;

    async function boot() {
      // ── Priority 1: Recover by hostname from Supabase ──
      // This is the most reliable recovery path. The hostname is baked into
      // the Pi's OS (derived from MAC address) and passed as a URL param
      // every boot. Even if localStorage is completely wiped, we can find
      // our screen row by hostname.
      if (screenName) {
        try {
          const { data: hostnameMatch } = await supabase
            .from('screens')
            .select('id, code, assigned_path')
            .eq('name', screenName)
            .order('last_seen', { ascending: false })
            .limit(1)
            .single();

          if (hostnameMatch) {
            // Found our screen row — restore localStorage
            localStorage.setItem(ID_STORAGE_KEY, hostnameMatch.id);
            if (hostnameMatch.code) localStorage.setItem(CODE_STORAGE_KEY, hostnameMatch.code);

            // Heartbeat
            await supabase.from('screens').update({
              last_seen: new Date().toISOString(),
              user_agent: navigator.userAgent,
            }).eq('id', hostnameMatch.id);

            if (hostnameMatch.assigned_path) {
              // We have an assignment — go there immediately
              localStorage.setItem(PATH_STORAGE_KEY, hostnameMatch.assigned_path);
              window.location.href = hostnameMatch.assigned_path;
              return;
            }

            // Row exists but not assigned yet — resume waiting
            if (!cancelledRef.current) {
              setCode(hostnameMatch.code);
              setScreenId(hostnameMatch.id);
              setStatus('waiting');
              return;
            }
          }
        } catch {
          // Network error on hostname lookup — fall through to localStorage
        }
      }

      // ── Priority 2: Recover by localStorage ──
      const savedId = localStorage.getItem(ID_STORAGE_KEY);
      const savedPath = localStorage.getItem(PATH_STORAGE_KEY);

      // Fast path: we have a remembered assignment — verify row exists, then go
      if (savedId && savedPath) {
        try {
          const { data } = await supabase
            .from('screens')
            .select('id, assigned_path')
            .eq('id', savedId)
            .single();

          if (data) {
            // Row still exists — heartbeat and navigate
            await supabase.from('screens').update({
              last_seen: new Date().toISOString(),
              current_page: savedPath,
              user_agent: navigator.userAgent,
              ...(screenName && { name: screenName }),
            }).eq('id', savedId);

            // Use assigned_path if it differs (admin might have reassigned while off)
            const targetPath = data.assigned_path || savedPath;
            localStorage.setItem(PATH_STORAGE_KEY, targetPath);
            window.location.href = targetPath;
            return;
          }
        } catch {
          // Network error — use saved path as fallback (go to last known page)
          window.location.href = savedPath;
          return;
        }

        // Row was deleted by admin — clear everything, fall through to register
        localStorage.removeItem(ID_STORAGE_KEY);
        localStorage.removeItem(CODE_STORAGE_KEY);
        localStorage.removeItem(PATH_STORAGE_KEY);
      }

      // Medium path: we have an ID but no remembered path — resume waiting
      if (savedId && !savedPath) {
        try {
          const { data } = await supabase
            .from('screens')
            .select('id, code, assigned_path')
            .eq('id', savedId)
            .single();

          if (!cancelledRef.current && data) {
            // Update heartbeat
            await supabase.from('screens').update({
              last_seen: new Date().toISOString(),
              user_agent: navigator.userAgent,
              ...(screenName && { name: screenName }),
            }).eq('id', data.id);

            // Already assigned since last time?
            if (data.assigned_path) {
              localStorage.setItem(PATH_STORAGE_KEY, data.assigned_path);
              window.location.href = data.assigned_path;
              return;
            }

            // Resume waiting with existing code
            setCode(data.code);
            setScreenId(data.id);
            setStatus('waiting');
            return;
          }
        } catch {
          // Network error — stay on registration page, will retry
        }

        // Row was deleted — clear and fall through
        localStorage.removeItem(ID_STORAGE_KEY);
        localStorage.removeItem(CODE_STORAGE_KEY);
      }

      // ── Priority 3: Fresh device — register new code ──
      if (cancelledRef.current) return;
      setStatus('registering');

      let newCode = generateCode();
      let attempts = 0;

      while (!cancelledRef.current && attempts < 10) {
        const { data, error } = await supabase
          .from('screens')
          .insert({
            code: newCode,
            last_seen: new Date().toISOString(),
            user_agent: navigator.userAgent,
            ...(screenName && { name: screenName }),
          })
          .select('id, code, assigned_path')
          .single();

        if (!error && data) {
          localStorage.setItem(CODE_STORAGE_KEY, newCode);
          localStorage.setItem(ID_STORAGE_KEY, data.id);
          setCode(data.code);
          setScreenId(data.id);
          setStatus('waiting');
          return;
        }

        if (error?.code === '23505') {
          // Code collision — retry
          newCode = generateCode();
          attempts++;
          continue;
        }

        // Other error — wait and retry
        await new Promise((r) => setTimeout(r, 2000));
        attempts++;
      }
    }

    boot();
    return () => { cancelledRef.current = true; };
  }, []);

  // ── 2. Polling heartbeat + assignment check (REST-first) ──
  useEffect(() => {
    if (!screenId) return;

    async function poll() {
      try {
        const { data, error } = await supabase
          .from('screens')
          .update({
            last_seen: new Date().toISOString(),
            current_page: '/screen',
          })
          .eq('id', screenId)
          .select('assigned_path')
          .single();

        if (error) {
          // Only re-register if the row is truly gone (PGRST116 = no rows found)
          // Other errors (network, rate limit) are silently retried next poll
          if (error.code === 'PGRST116') {
            localStorage.removeItem(ID_STORAGE_KEY);
            localStorage.removeItem(CODE_STORAGE_KEY);
            localStorage.removeItem(PATH_STORAGE_KEY);
            window.location.reload();
          }
          return;
        }

        if (data?.assigned_path) {
          localStorage.setItem(PATH_STORAGE_KEY, data.assigned_path);
          window.location.href = data.assigned_path;
        }
      } catch {
        // Network error — silently fail, retry next poll
      }
    }

    const interval = setInterval(poll, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [screenId]);

  // ── 3. Realtime subscription (bonus — instant assignment pickup) ──
  useEffect(() => {
    if (!screenId) return;

    const channel = supabase
      .channel(`screen-${screenId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'screens',
          filter: `id=eq.${screenId}`,
        },
        (payload) => {
          const updated = payload.new as Screen;
          if (updated.assigned_path) {
            // Save and navigate — NEVER delete the row
            localStorage.setItem(PATH_STORAGE_KEY, updated.assigned_path);
            window.location.href = updated.assigned_path;
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [screenId]);

  // ── 4. Connection health (auto-reload on prolonged disconnect) ──
  useEffect(() => {
    let disconnectedAt: number | null = null;

    const checkInterval = setInterval(() => {
      const channels = supabase.getChannels();
      const allDisconnected =
        channels.length > 0 &&
        channels.every((ch) => ch.state === 'closed' || ch.state === 'errored');

      if (allDisconnected) {
        if (!disconnectedAt) disconnectedAt = Date.now();
        else if (Date.now() - disconnectedAt > 120_000) {
          window.location.reload();
        }
      } else {
        disconnectedAt = null;
      }
    }, 5000);

    return () => clearInterval(checkInterval);
  }, []);

  // ── Render: booting / registering ──
  if (status === 'booting' || status === 'registering') {
    return (
      <div style={{
        width: '100vw', height: '100vh', background: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(255,255,255,0.4)', fontSize: '2vw',
        fontFamily: "var(--font-bebas-neue), 'Bebas Neue', Impact, sans-serif",
      }}>
        {status === 'booting' ? 'Starting up...' : 'Registering...'}
      </div>
    );
  }

  // ── Render: waiting for assignment ──
  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#000',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      overflow: 'hidden',
    }}>
      <div style={{ width: '80%', maxWidth: 800 }}>
        <ElectricHeader title="Screen Setup" fontSize="3vw" />
        <LightningBorder />
      </div>

      <div style={{ textAlign: 'center', marginTop: '4vh' }}>
        <div style={{
          fontSize: 'min(20vw, 25vh)',
          fontWeight: 400,
          letterSpacing: '0.3em',
          color: '#f0f0ff',
          textShadow: '0 0 20px rgba(139,92,246,0.8), 0 0 60px rgba(139,92,246,0.4)',
          fontFamily: "var(--font-bebas-neue), 'Bebas Neue', Impact, sans-serif",
          lineHeight: 1,
        }}>
          {code}
        </div>

        <div style={{
          fontSize: 'min(2.5vw, 3vh)',
          color: 'rgba(255,255,255,0.3)',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          marginTop: '3vh',
          fontFamily: "var(--font-bebas-neue), 'Bebas Neue', Impact, sans-serif",
        }}>
          Awaiting Assignment...
        </div>
      </div>

      <div style={{ width: '80%', maxWidth: 800, marginTop: '4vh' }}>
        <LightningBorder />
      </div>

      <div style={{
        position: 'fixed', bottom: '3vh',
        fontSize: 'min(1.2vw, 1.5vh)',
        color: 'rgba(255,255,255,0.15)',
        letterSpacing: '0.15em',
        textAlign: 'center',
        fontFamily: "var(--font-bebas-neue), 'Bebas Neue', Impact, sans-serif",
      }}>
        Enter this code in the admin panel to assign a display
      </div>

      {/* Subtle pulsing glow behind the code */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '40vw', height: '40vh',
        background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
        animation: 'screen-pulse 3s ease-in-out infinite',
      }} />

      <style>{`
        @keyframes screen-pulse {
          0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
        }
      `}</style>
    </div>
  );
}
