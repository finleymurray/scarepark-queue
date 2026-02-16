'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import ElectricHeader from '@/components/ElectricHeader';
import LightningBorder from '@/components/LightningBorder';
import type { Screen } from '@/types/database';

/* ── Constants ── */

const SAFE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 4;
const HEARTBEAT_INTERVAL = 30_000;
const CODE_STORAGE_KEY = 'ic-screen-code';
const ID_STORAGE_KEY = 'ic-screen-id';

function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)];
  }
  return code;
}

/* ── Component ── */

export default function ScreenController() {
  const [code, setCode] = useState<string | null>(null);
  const [assignedPath, setAssignedPath] = useState<string | null>(null);
  const [screenId, setScreenId] = useState<string | null>(null);
  const [status, setStatus] = useState<'registering' | 'waiting' | 'assigned'>('registering');

  // ── 1. Register on mount ──
  useEffect(() => {
    let cancelled = false;

    async function register() {
      const existingCode = localStorage.getItem(CODE_STORAGE_KEY);

      if (existingCode) {
        // Verify code still exists in DB
        const { data } = await supabase
          .from('screens')
          .select('id, code, assigned_path')
          .eq('code', existingCode)
          .single();

        if (!cancelled && data) {
          // Update heartbeat
          await supabase.from('screens').update({
            last_seen: new Date().toISOString(),
            user_agent: navigator.userAgent,
          }).eq('id', data.id);

          setCode(data.code);
          setScreenId(data.id);

          localStorage.setItem(ID_STORAGE_KEY, data.id);

          if (data.assigned_path) {
            // Already assigned — navigate immediately
            window.location.href = data.assigned_path;
            return;
          }

          setStatus('waiting');
          return;
        }
        // Code was deleted from DB — fall through to generate new one
      }

      // Generate a new code, retry on collision
      let newCode = generateCode();
      let attempts = 0;

      while (!cancelled && attempts < 10) {
        const { data, error } = await supabase
          .from('screens')
          .insert({
            code: newCode,
            last_seen: new Date().toISOString(),
            user_agent: navigator.userAgent,
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
          // Unique constraint violation — code collision, retry
          newCode = generateCode();
          attempts++;
          continue;
        }

        // Other error — wait and retry
        await new Promise((r) => setTimeout(r, 2000));
        attempts++;
      }
    }

    register();
    return () => { cancelled = true; };
  }, []);

  // ── 2. Heartbeat ──
  useEffect(() => {
    if (!screenId) return;

    const interval = setInterval(async () => {
      const { error } = await supabase
        .from('screens')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', screenId);

      // Row was deleted — re-register
      if (error) {
        localStorage.removeItem(CODE_STORAGE_KEY);
        localStorage.removeItem(ID_STORAGE_KEY);
        window.location.reload();
      }
    }, HEARTBEAT_INTERVAL);

    return () => clearInterval(interval);
  }, [screenId]);

  // ── 3. Realtime subscription for assignment ──
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
            setAssignedPath(updated.assigned_path);
            setStatus('assigned');
          }
        },
      )
      .subscribe();

    // Also listen for broadcast commands (reload)
    const cmdChannel = supabase
      .channel(`screen-cmd-${screenId}`)
      .on('broadcast', { event: 'reload' }, () => {
        window.location.reload();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(cmdChannel);
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
        else if (Date.now() - disconnectedAt > 30_000) {
          window.location.reload();
        }
      } else {
        disconnectedAt = null;
      }
    }, 5000);

    return () => clearInterval(checkInterval);
  }, []);

  // ── 5. Navigate when assigned ──
  useEffect(() => {
    if (status === 'assigned' && assignedPath) {
      window.location.href = assignedPath;
    }
  }, [status, assignedPath]);

  // ── Render: registering state ──
  if (status === 'registering') {
    return (
      <div style={{
        width: '100vw', height: '100vh', background: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(255,255,255,0.4)', fontSize: '2vw',
        fontFamily: "var(--font-bebas-neue), 'Bebas Neue', Impact, sans-serif",
      }}>
        Registering...
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
