'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { surface, border, text, accents, radius, microLabel, FONT_NUM } from '@/lib/theme';
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

  // ── Shared page shell ──
  const accent = accents.control;

  const keyframes = (
    <style>{`
      @keyframes screen-dot-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50%      { opacity: 0.35; transform: scale(0.82); }
      }
      @keyframes screen-glow-pulse {
        0%, 100% { opacity: 0.45; }
        50%      { opacity: 0.85; }
      }
    `}</style>
  );

  const logo = (
    <Image
      src="/logo.png"
      alt="CoreLink"
      width={56}
      height={56}
      priority
      style={{ width: 56, height: 'auto', marginBottom: 18 }}
    />
  );

  // ── Render: booting / registering ──
  if (status === 'booting' || status === 'registering') {
    return (
      <div style={{
        width: '100vw', minHeight: '100vh', background: surface.page,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: '0 24px', boxSizing: 'border-box',
      }}>
        {logo}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 9, height: 9, borderRadius: '50%', background: accent.base,
            boxShadow: `0 0 10px ${accent.base}`,
            animation: 'screen-dot-pulse 1.4s ease-in-out infinite',
          }} />
          <span style={{ color: text.secondary, fontSize: 15 }}>
            {status === 'booting' ? 'Starting up…' : 'Registering this screen…'}
          </span>
        </div>
        {keyframes}
      </div>
    );
  }

  // ── Render: waiting for assignment ──
  const chars = (code ?? '').split('');

  return (
    <div style={{
      width: '100vw', minHeight: '100vh', background: surface.page,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      padding: '24px', boxSizing: 'border-box', overflow: 'hidden',
    }}>
      <div style={{
        position: 'relative',
        width: '100%', maxWidth: 720,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        background: surface.card,
        border: `1px solid ${border.default}`,
        borderRadius: radius.xl,
        padding: 'clamp(28px, 5vh, 56px) clamp(20px, 5vw, 56px)',
        boxSizing: 'border-box',
      }}>
        {logo}

        <h1 style={{
          color: text.primary, fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em',
        }}>
          Screen Setup
        </h1>
        <p style={{ color: text.faint, fontSize: 13, marginTop: 4, marginBottom: 0 }}>
          CoreLink Operations Platform
        </p>

        {/* Code hero */}
        <div style={{
          position: 'relative',
          marginTop: 'clamp(28px, 5vh, 48px)',
          width: '100%',
          display: 'flex', justifyContent: 'center',
        }}>
          {/* Subtle blue glow behind the tiles */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90%', height: '160%',
            background: `radial-gradient(ellipse at center, ${accent.soft} 0%, transparent 70%)`,
            pointerEvents: 'none',
            animation: 'screen-glow-pulse 3s ease-in-out infinite',
          }} />

          <div style={{
            position: 'relative',
            display: 'flex', gap: 'clamp(8px, 2vw, 18px)',
          }}>
            {chars.map((ch, i) => (
              <div
                key={i}
                style={{
                  background: surface.control,
                  border: `1px solid ${accent.base}`,
                  borderRadius: radius.lg,
                  boxShadow: `0 0 24px ${accent.soft}, inset 0 0 0 1px rgba(59,130,246,0.08)`,
                  width: 'clamp(56px, 16vw, 130px)',
                  height: 'clamp(72px, 20vw, 168px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: text.primary,
                  fontSize: 'clamp(40px, 12vw, 104px)',
                  fontWeight: 700,
                  lineHeight: 1,
                  fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
                  ...FONT_NUM,
                }}
              >
                {ch}
              </div>
            ))}
          </div>
        </div>

        <p style={{
          ...microLabel,
          color: text.muted,
          marginTop: 'clamp(20px, 4vh, 32px)',
          marginBottom: 0,
          textAlign: 'center',
        }}>
          Enter this code in Admin → Screens
        </p>

        {/* Live status line */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          marginTop: 'clamp(20px, 4vh, 32px)',
          padding: '8px 16px',
          background: surface.control,
          border: `1px solid ${border.default}`,
          borderRadius: radius.pill,
        }}>
          <span style={{
            width: 9, height: 9, borderRadius: '50%',
            background: '#22C55E', boxShadow: '0 0 10px rgba(34,197,94,0.8)',
            animation: 'screen-dot-pulse 1.4s ease-in-out infinite',
          }} />
          <span style={{ color: text.secondary, fontSize: 14, fontWeight: 500 }}>
            Waiting for assignment…
          </span>
        </div>
      </div>

      {keyframes}
    </div>
  );
}
