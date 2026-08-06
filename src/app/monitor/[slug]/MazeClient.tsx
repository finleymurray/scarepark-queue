'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkAuth } from '@/lib/auth';
import type { Attraction, MazeZone } from '@/types/database';
import { getFloorplan } from '@/lib/floorplans';
import Floorplan, { FloorplanLegend } from '@/components/floorplan/Floorplan';
import AppSwitcher from '@/components/AppSwitcher';
import { surface, border, text, accents, radius, statusColors, microLabel } from '@/lib/theme';

const accent = accents.monitor;

const EXT_LABELS: Record<string, string> = {
  water: 'Water',
  co2: 'CO₂',
  foam: 'Foam',
  fire: 'Fire extinguisher',
};

function EquipChip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', color,
      border: `1px solid ${color}44`, borderRadius: radius.pill, padding: '2px 8px',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

export default function MazeClient() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [attraction, setAttraction] = useState<Attraction | null>(null);
  const [zones, setZones] = useState<MazeZone[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);

  const plan = useMemo(() => getFloorplan(slug), [slug]);
  const zonesBySlug = useMemo(() => {
    const map: Record<string, MazeZone> = {};
    for (const z of zones) map[z.slug] = z;
    return map;
  }, [zones]);

  useEffect(() => {
    async function init() {
      const auth = await checkAuth();
      if (!auth.authenticated || !auth.role) {
        window.location.href = `/login?next=/monitor/${slug}`;
        return;
      }
      setIsAdmin(auth.role === 'admin');

      const { data: attractionData } = await supabase
        .from('attractions').select('*').eq('slug', slug).single();
      if (!attractionData) { setLoading(false); return; }

      if (
        auth.role === 'supervisor' &&
        auth.allowedAttractions && auth.allowedAttractions.length > 0 &&
        !auth.allowedAttractions.includes(attractionData.id)
      ) {
        setDenied(true);
        setLoading(false);
        return;
      }

      setAttraction(attractionData as Attraction);
      const { data: zoneData } = await supabase
        .from('maze_zones')
        .select('*')
        .eq('attraction_id', attractionData.id)
        .order('sort_order', { ascending: true });
      if (zoneData) setZones(zoneData as MazeZone[]);
      setLoading(false);
    }
    init();
  }, [slug]);

  const sc = attraction ? statusColors(attraction.status) : null;

  return (
    <div style={{ minHeight: '100vh', background: surface.page }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px',
        borderBottom: `1px solid ${border.default}`, background: surface.card,
      }}>
        <AppSwitcher currentApp="monitor" isAdmin={isAdmin} />
        <Link href="/monitor" style={{ color: text.muted, fontSize: 12, textDecoration: 'none' }}>← Mazes</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ color: text.primary, fontSize: 17, fontWeight: 700 }}>{attraction?.name ?? '…'}</h1>
          {attraction && sc && (
            <span style={{
              color: sc.text, background: sc.soft, fontSize: 10, fontWeight: 700,
              padding: '3px 8px', borderRadius: radius.pill, letterSpacing: '0.05em',
            }}>
              {attraction.status}
            </span>
          )}
        </div>
        <span style={{ marginLeft: 'auto', ...microLabel }}>Floorplan & locations</span>
      </header>

      {loading ? (
        <main style={{ padding: 40 }}><p style={{ color: text.muted, fontSize: 13 }}>Loading…</p></main>
      ) : denied ? (
        <main style={{ padding: 40 }}>
          <p style={{ color: text.secondary, fontSize: 14 }}>You don&apos;t have access to this attraction.</p>
        </main>
      ) : !attraction ? (
        <main style={{ padding: 40 }}>
          <p style={{ color: text.secondary, fontSize: 14 }}>Attraction not found.</p>
        </main>
      ) : (
        <main style={{
          maxWidth: 1400, margin: '0 auto', padding: '22px 22px 60px',
          display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 330px', gap: 18, alignItems: 'start',
        }}>
          {/* Floorplan */}
          <section style={{ background: surface.card, border: `1px solid ${border.default}`, borderRadius: radius.xl, padding: 16, minWidth: 0 }}>
            {plan ? (
              <>
                <Floorplan def={plan} zones={zonesBySlug} selected={selected} onSelect={setSelected} />
                <FloorplanLegend theme={plan.theme} />
                <p style={{ color: text.faint, fontSize: 11, marginTop: 10 }}>
                  Zone sequence & equipment from the CoSWP (§11 Floorplan &amp; Locations, §13.2 E-Stop Locations).
                  Room shapes are indicative until measured plans are added.
                </p>
              </>
            ) : (
              <div style={{ padding: '80px 20px', textAlign: 'center' }}>
                <p style={{ color: text.secondary, fontSize: 15, fontWeight: 600 }}>No floorplan yet</p>
                <p style={{ color: text.muted, fontSize: 13, marginTop: 8 }}>
                  This maze doesn&apos;t have a CoSWP on file — once it exists, its zones and floorplan will appear here.
                </p>
              </div>
            )}
          </section>

          {/* Zone rail */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ ...microLabel, padding: '0 2px' }}>
              Zones {zones.length > 0 && `· ${zones.filter((z) => z.zone_number != null).length}`}
            </p>
            {zones.length === 0 && (
              <p style={{ color: text.muted, fontSize: 12, padding: '0 2px' }}>No zones recorded.</p>
            )}
            {zones.map((z) => {
              const isSel = selected === z.slug;
              return (
                <button
                  key={z.id}
                  onClick={() => setSelected(isSel ? null : z.slug)}
                  style={{
                    textAlign: 'left', cursor: 'pointer',
                    background: isSel ? accent.soft : surface.card,
                    border: `1px solid ${isSel ? accent.base : border.default}`,
                    borderRadius: radius.md, padding: '10px 12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      color: z.is_bypass ? text.muted : accent.text, fontSize: 10, fontWeight: 800,
                      letterSpacing: '0.06em', minWidth: 24,
                    }}>
                      {z.is_bypass ? '↔' : `Z${z.zone_number}`}
                    </span>
                    <span style={{ color: text.primary, fontSize: 13, fontWeight: 600, flex: 1 }}>{z.name}</span>
                    {z.level !== 0 && <EquipChip label="LOWER" color={text.muted} />}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7, paddingLeft: 32 }}>
                    {z.is_entrance && <EquipChip label="ENTRANCE" color={accent.text} />}
                    {z.is_exit && <EquipChip label="EXIT" color={accent.text} />}
                    {z.is_bypass && <EquipChip label="ACCESSIBLE BYPASS" color={text.secondary} />}
                    {z.has_estop && <EquipChip label="E-STOP" color="#F87171" />}
                    {z.has_break_glass && <EquipChip label="BREAK GLASS" color="#FBBF24" />}
                    {z.extinguishers.map((e) => (
                      <EquipChip key={e} label={EXT_LABELS[e] ?? e} color="#60A5FA" />
                    ))}
                  </div>
                  {isSel && z.notes && (
                    <p style={{ color: text.secondary, fontSize: 12, marginTop: 8, paddingLeft: 32, lineHeight: 1.5 }}>
                      {z.notes}
                    </p>
                  )}
                </button>
              );
            })}
          </aside>
        </main>
      )}
    </div>
  );
}
