'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { checkAuth } from '@/lib/auth';
import type { Attraction, MazeZone } from '@/types/database';
import { floorplans } from '@/lib/floorplans';
import AppSwitcher from '@/components/AppSwitcher';
import { surface, border, text, accents, radius, statusColors, microLabel, FONT_NUM } from '@/lib/theme';

const accent = accents.monitor;

export default function MonitorIndex() {
  const [mazes, setMazes] = useState<Attraction[]>([]);
  const [zonesByAttraction, setZonesByAttraction] = useState<Record<string, MazeZone[]>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-GB'));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    async function init() {
      const auth = await checkAuth();
      if (!auth.authenticated || !auth.role) {
        window.location.href = '/login?next=/monitor';
        return;
      }
      setIsAdmin(auth.role === 'admin');
      setDisplayName(auth.displayName || auth.email || '');

      let attractionsQuery = supabase
        .from('attractions')
        .select('*')
        .eq('attraction_type', 'ride')
        .order('sort_order', { ascending: true });
      if (auth.role === 'supervisor' && auth.allowedAttractions && auth.allowedAttractions.length > 0) {
        attractionsQuery = attractionsQuery.in('id', auth.allowedAttractions);
      }

      const [attractionsRes, zonesRes] = await Promise.all([
        attractionsQuery,
        supabase.from('maze_zones').select('*').order('sort_order', { ascending: true }),
      ]);

      if (attractionsRes.data) setMazes(attractionsRes.data as Attraction[]);
      if (zonesRes.data) {
        const grouped: Record<string, MazeZone[]> = {};
        for (const z of zonesRes.data as MazeZone[]) {
          (grouped[z.attraction_id] ??= []).push(z);
        }
        setZonesByAttraction(grouped);
      }
      setLoading(false);
    }
    init();
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: surface.page }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px',
        borderBottom: `1px solid ${border.default}`, background: surface.card,
      }}>
        <AppSwitcher currentApp="monitor" isAdmin={isAdmin} />
        <div>
          <h1 style={{ color: text.primary, fontSize: 17, fontWeight: 700, lineHeight: 1.2 }}>Monitor</h1>
          <p style={{ color: text.muted, fontSize: 11 }}>Pick a maze to open its CCTV & safety console</p>
        </div>
        <span style={{ marginLeft: 'auto', color: text.muted, fontSize: 12 }}>{displayName}</span>
        <span style={{ color: text.primary, fontSize: 15, fontWeight: 600, ...FONT_NUM }}>{clock}</span>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '26px 22px 60px' }}>
        <p style={{ ...microLabel, marginBottom: 12 }}>Mazes</p>
        {loading ? (
          <p style={{ color: text.muted, fontSize: 13 }}>Loading…</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {mazes.map((m) => {
              const zones = zonesByAttraction[m.id] ?? [];
              const cams = zones.filter((z) => z.zone_number != null).length;
              const hasPlan = Boolean(floorplans[m.slug]);
              const sc = statusColors(m.status);
              return (
                <Link
                  key={m.id}
                  href={`/monitor/${m.slug}`}
                  style={{
                    display: 'block', textDecoration: 'none',
                    background: surface.card, border: `1px solid ${border.default}`,
                    borderLeft: `3px solid ${hasPlan ? accent.base : border.strong}`,
                    borderRadius: radius.lg, padding: '16px 18px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ color: text.primary, fontSize: 15, fontWeight: 700 }}>{m.name}</span>
                    <span style={{
                      color: sc.text, background: sc.soft, fontSize: 10, fontWeight: 700,
                      padding: '3px 8px', borderRadius: radius.pill, letterSpacing: '0.05em',
                    }}>
                      {m.status}
                    </span>
                  </div>
                  <p style={{ color: text.muted, fontSize: 12, marginTop: 8 }}>
                    {hasPlan
                      ? `${cams} cameras · ${zones.filter((z) => z.has_estop).length} E-Stops · ${zones.filter((z) => z.has_break_glass).length} break-glass points`
                      : 'Awaiting CoSWP — no floorplan yet'}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
