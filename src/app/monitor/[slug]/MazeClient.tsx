'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { checkAuth } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import type { Attraction, MazeZone, Alert } from '@/types/database';
import { getFloorplan } from '@/lib/floorplans';
import Floorplan, { FloorplanLegend } from '@/components/floorplan/Floorplan';
import AppSwitcher from '@/components/AppSwitcher';
import CamTile from '@/components/monitor/CamTile';
import IncidentForm, { type IncidentFormValues } from '@/components/IncidentForm';
import { useToasts, ToastStack } from '@/components/ui/Toast';
import { surface, border, text, accents, radius, statusColors, microLabel, FONT_NUM } from '@/lib/theme';

const accent = accents.monitor;

const EXT_LABELS: Record<string, string> = {
  water: 'Water',
  co2: 'CO₂',
  foam: 'Foam',
  fire: 'Fire extinguisher',
};

const ALERT_COLORS: Record<Alert['level'], string> = {
  info: '#60A5FA',
  warning: '#FBBF24',
  urgent: '#F87171',
};

function getTodayDateStr(): string {
  return new Date().toISOString().split('T')[0];
}

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

function StatusChip({ label, tone }: { label: string; tone: 'ok' | 'warn' | 'muted' }) {
  const color = tone === 'ok' ? '#4ADE80' : tone === 'warn' ? '#FBBF24' : text.muted;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color,
      border: `1px solid ${color}44`, borderRadius: radius.pill, padding: '3px 10px',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {label}
    </span>
  );
}

function MazeConsole() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const searchParams = useSearchParams();
  const camParam = searchParams.get('cam');

  const [attraction, setAttraction] = useState<Attraction | null>(null);
  const [zones, setZones] = useState<MazeZone[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [focusCam, setFocusCam] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'focus'>('grid');
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [holdReq, setHoldReq] = useState<{ id: string; at: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reporter, setReporter] = useState('');
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState('');
  const { toasts, pushToast } = useToasts();

  const plan = useMemo(() => getFloorplan(slug), [slug]);
  const zonesBySlug = useMemo(() => {
    const map: Record<string, MazeZone> = {};
    for (const z of zones) map[z.slug] = z;
    return map;
  }, [zones]);
  const cameraZones = useMemo(() => zones.filter((z) => z.zone_number != null), [zones]);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-GB'));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alertsChannel: ReturnType<typeof supabase.channel> | null = null;

    async function fetchAlerts(attractionId: string) {
      const { data } = await supabase
        .from('alerts')
        .select('*')
        .eq('active', true)
        .or(`target_all.eq.true,attraction_id.eq.${attractionId}`)
        .order('created_at', { ascending: false })
        .limit(8);
      if (data) setAlerts(data as Alert[]);
    }

    async function init() {
      const auth = await checkAuth();
      if (!auth.authenticated || !auth.role) {
        window.location.href = `/login?next=/monitor/${slug}`;
        return;
      }
      setIsAdmin(auth.role === 'admin');
      setReporter(auth.displayName || auth.email || 'Monitor');

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
      if (zoneData) {
        const zs = zoneData as MazeZone[];
        setZones(zs);
        // Arriving from the wall with ?cam= opens that feed in focus view.
        if (camParam && zs.some((z) => z.slug === camParam && z.zone_number != null)) {
          setFocusCam(camParam);
          setSelected(camParam);
          setViewMode('focus');
        } else {
          const first = zs.find((z) => z.zone_number != null);
          if (first) setFocusCam(first.slug);
        }
      }

      await fetchAlerts(attractionData.id);
      alertsChannel = supabase
        .channel(`monitor-alerts-${attractionData.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
          fetchAlerts(attractionData.id);
        })
        .subscribe();

      setLoading(false);
    }
    init();
    return () => { if (alertsChannel) supabase.removeChannel(alertsChannel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  /** Map/zone-rail selection pulls the zone's camera into focus view. */
  function selectZone(zoneSlug: string | null) {
    setSelected(zoneSlug);
    if (zoneSlug && zonesBySlug[zoneSlug]?.zone_number != null) {
      setFocusCam(zoneSlug);
      setViewMode('focus');
    }
  }

  async function handleLogIncident(values: IncidentFormValues) {
    if (!attraction) return;
    const { error } = await supabase.from('incidents').insert({
      attraction_id: attraction.id,
      attraction_name: attraction.name,
      log_date: getTodayDateStr(),
      source: 'staff',
      status: 'submitted',
      incident_type: values.incident_type,
      category: values.category,
      severity: values.severity,
      description: values.description,
      people_involved: values.people_involved,
      actions_taken: values.actions_taken,
      form_data: { ...values.form_data, reported_from: 'monitor', camera_focus: focusCam },
      reported_by: reporter,
    });
    if (error) throw error; // surfaced by IncidentForm
    pushToast('success', 'Incident report submitted');
    setIncidentOpen(false);
  }

  /** Real dispatch-hold request: an urgent alert Control sees instantly, audited. */
  async function handleHoldRequest() {
    if (!attraction) return;
    if (holdReq) {
      // Second press clears the request.
      const { error } = await supabase.from('alerts').update({ active: false }).eq('id', holdReq.id);
      if (error) { pushToast('error', 'Could not clear the hold request — try again'); return; }
      await logAudit({
        actionType: 'monitor_hold_cleared',
        attractionId: attraction.id,
        attractionName: attraction.name,
        performedBy: reporter,
        details: `Dispatch hold request cleared at ${new Date().toLocaleTimeString('en-GB')}`,
      });
      setHoldReq(null);
      pushToast('success', 'Hold request cleared');
      return;
    }
    const { data, error } = await supabase
      .from('alerts')
      .insert({
        message: `MONITOR — ${attraction.name}: HOLD DISPATCH requested by ${reporter}. Confirm on radio.`,
        level: 'urgent',
        target_all: false,
        attraction_id: attraction.id,
        active: true,
        created_by: reporter,
      })
      .select('id')
      .single();
    if (error || !data) { pushToast('error', 'Could not send the hold request — use the radio'); return; }
    await logAudit({
      actionType: 'monitor_hold_request',
      attractionId: attraction.id,
      attractionName: attraction.name,
      performedBy: reporter,
      details: `Dispatch hold requested from the Monitor seat`,
    });
    setHoldReq({ id: data.id, at: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) });
    pushToast('success', 'Hold request sent — Control sees it now; confirm on the radio');
  }

  const sc = attraction ? statusColors(attraction.status) : null;
  const focusZone = focusCam ? zonesBySlug[focusCam] : null;

  return (
    <div style={{ minHeight: '100vh', background: '#070809' }}>
      {/* ── status bar ── */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 18px',
        borderBottom: `1px solid ${border.default}`, background: surface.card,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <AppSwitcher currentApp="monitor" isAdmin={isAdmin} />
        <Link href="/monitor" style={{ color: text.muted, fontSize: 12, textDecoration: 'none' }}>← Mazes</Link>
        <h1 style={{ color: text.primary, fontSize: 16, fontWeight: 700 }}>{attraction?.name ?? '…'}</h1>
        {attraction && sc && (
          <span style={{
            color: sc.text, background: sc.soft, fontSize: 10, fontWeight: 700,
            padding: '3px 8px', borderRadius: radius.pill, letterSpacing: '0.05em',
          }}>
            {attraction.status}
          </span>
        )}
        <StatusChip label={`CAMS 0/${cameraZones.length} — AWAITING INSTALL`} tone="warn" />
        <span className="hidden md:inline-flex"><StatusChip label="E-STOP CHAIN — NOT COMMISSIONED" tone="muted" /></span>
        {holdReq && <StatusChip label={`HOLD REQUESTED ${holdReq.at}`} tone="warn" />}
        <span className="hidden sm:inline" style={{ marginLeft: 'auto', color: text.muted, fontSize: 12 }}>{reporter}</span>
        <span style={{ color: text.primary, fontSize: 14, fontWeight: 600, ...FONT_NUM }}>{clock}</span>
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
        <main style={{ padding: '14px 18px 40px' }}>
          {/* ── CCTV wall — the main surface ── */}
          <section style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <p style={microLabel}>CCTV</p>
              <p style={{ ...microLabel, color: text.faint }}>
                {viewMode === 'focus' && focusZone
                  ? `FOCUS: CAM ${focusZone.zone_number} · ${focusZone.name}`
                  : `ALL FEEDS · ${cameraZones.length}`}
              </p>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setViewMode('grid')}
                  style={{
                    cursor: 'pointer', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                    padding: '5px 12px', borderRadius: radius.pill,
                    background: viewMode === 'grid' ? accent.soft : surface.control,
                    border: `1px solid ${viewMode === 'grid' ? accent.base : border.strong}`,
                    color: viewMode === 'grid' ? accent.text : text.secondary,
                  }}
                >
                  GRID
                </button>
                <button
                  onClick={() => setViewMode('focus')}
                  style={{
                    cursor: 'pointer', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                    padding: '5px 12px', borderRadius: radius.pill,
                    background: viewMode === 'focus' ? accent.soft : surface.control,
                    border: `1px solid ${viewMode === 'focus' ? accent.base : border.strong}`,
                    color: viewMode === 'focus' ? accent.text : text.secondary,
                  }}
                >
                  FOCUS
                </button>
              </div>
            </div>

            {cameraZones.length === 0 ? (
              <div style={{ border: `1px dashed ${border.strong}`, borderRadius: radius.md, padding: '40px 16px', textAlign: 'center' }}>
                <p style={{ color: text.muted, fontSize: 13 }}>
                  Cameras are assigned per zone — this maze has no zones recorded yet.
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fill, minmax(min(340px, 100%), 1fr))`,
                gap: 10,
              }}>
                {cameraZones.map((z) => (
                  <CamTile
                    key={z.slug}
                    label={`CAM ${z.zone_number} · ${z.name.toUpperCase()}`}
                    focused={focusCam === z.slug}
                    onClick={() => { setFocusCam(z.slug); setSelected(z.slug); setViewMode('focus'); }}
                  />
                ))}
              </div>
            ) : (
              <>
                <CamTile
                  large
                  focused
                  label={focusZone ? `CAM ${focusZone.zone_number} · ${focusZone.name.toUpperCase()}` : ''}
                />
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                  gap: 8, marginTop: 8,
                }}>
                  {cameraZones.map((z) => (
                    <CamTile
                      key={z.slug}
                      label={`C${z.zone_number}`}
                      focused={focusCam === z.slug}
                      onClick={() => { setFocusCam(z.slug); setSelected(z.slug); }}
                    />
                  ))}
                </div>
              </>
            )}
            <p style={{ color: text.faint, fontSize: 11, marginTop: 8 }}>
              Stand-in feeds — one camera per zone, live once the PoE cameras and on-site NVR are installed.
              Tapping a zone on the map pulls its camera to focus.
            </p>
          </section>

          {/* ── map + rail — stacks on phones, two columns from lg up ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,1fr)] items-start" style={{ gap: 16 }}>
            <section style={{ background: surface.card, border: `1px solid ${border.default}`, borderRadius: radius.xl, padding: 14, minWidth: 0 }}>
              <p style={{ ...microLabel, marginBottom: 10 }}>Live map — tap a zone to pull its camera</p>
              {plan ? (
                <>
                  <Floorplan def={plan} zones={zonesBySlug} selected={selected} onSelect={selectZone} />
                  <FloorplanLegend theme={plan.theme} />
                  <p style={{ color: text.faint, fontSize: 11, marginTop: 8 }}>
                    Zone sequence &amp; equipment from the CoSWP. Room shapes are indicative until measured plans are added.
                  </p>
                </>
              ) : (
                <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                  <p style={{ color: text.secondary, fontSize: 15, fontWeight: 600 }}>No floorplan yet</p>
                  <p style={{ color: text.muted, fontSize: 13, marginTop: 8 }}>
                    This maze doesn&apos;t have a CoSWP on file — once it exists, its zones and floorplan will appear here.
                  </p>
                </div>
              )}
            </section>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <section style={{ background: surface.card, border: `1px solid ${border.default}`, borderRadius: radius.xl, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                  <p style={microLabel}>Alerts</p>
                  <p style={{ ...microLabel, color: alerts.length ? '#FBBF24' : text.faint }}>{alerts.length} ACTIVE</p>
                </div>
                {alerts.length === 0 ? (
                  <p style={{ color: text.muted, fontSize: 12 }}>No active alerts. Park-wide and maze-targeted alerts appear here live.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {alerts.map((a) => (
                      <div key={a.id} style={{
                        background: surface.control, border: `1px solid ${border.default}`,
                        borderLeft: `3px solid ${ALERT_COLORS[a.level]}`,
                        borderRadius: radius.sm, padding: '8px 10px',
                      }}>
                        <p style={{ color: text.primary, fontSize: 12, lineHeight: 1.45 }}>{a.message}</p>
                        <p style={{ color: text.faint, fontSize: 10, marginTop: 3, ...FONT_NUM }}>
                          {a.target_all ? 'PARK-WIDE · ' : ''}
                          {new Date(a.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section style={{ background: surface.card, border: `1px solid ${border.default}`, borderRadius: radius.xl, padding: 14 }}>
                <p style={{ ...microLabel, marginBottom: 10 }}>
                  Zones · {zones.filter((z) => z.zone_number != null).length}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {zones.map((z) => {
                    const isSel = selected === z.slug;
                    return (
                      <button
                        key={z.id}
                        onClick={() => selectZone(isSel ? null : z.slug)}
                        style={{
                          textAlign: 'left', cursor: 'pointer',
                          background: isSel ? accent.soft : surface.control,
                          border: `1px solid ${isSel ? accent.base : border.default}`,
                          borderRadius: radius.md, padding: '9px 11px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: z.is_bypass ? text.muted : accent.text, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', minWidth: 24 }}>
                            {z.is_bypass ? '↔' : `Z${z.zone_number}`}
                          </span>
                          <span style={{ color: text.primary, fontSize: 12.5, fontWeight: 600, flex: 1 }}>{z.name}</span>
                          {z.level !== 0 && <EquipChip label="LOWER" color={text.muted} />}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6, paddingLeft: 32 }}>
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
                          <p style={{ color: text.secondary, fontSize: 11.5, marginTop: 7, paddingLeft: 32, lineHeight: 1.5 }}>
                            {z.notes}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>

          {/* ── control strip ── */}
          <div style={{
            display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16,
            background: surface.card, border: `1px solid ${border.default}`, borderRadius: radius.xl, padding: 12,
          }}>
            <button
              onClick={() => pushToast('error', 'E-Stop hardware not commissioned — use a physical stop button')}
              style={{
                flex: 1.4, minWidth: 150, cursor: 'pointer', textAlign: 'center', padding: '12px 10px',
                background: 'rgba(239,68,68,0.10)', border: '1px solid #7F1D1D', borderRadius: radius.md,
              }}
            >
              <span style={{ color: '#F87171', fontSize: 13, fontWeight: 800, letterSpacing: '0.18em' }}>E-STOP</span>
              <span style={{ display: 'block', color: text.faint, fontSize: 10, marginTop: 3 }}>
                not commissioned — use physical stops
              </span>
            </button>
            <button
              onClick={handleHoldRequest}
              style={{
                flex: 1, minWidth: 150, cursor: 'pointer', textAlign: 'center', padding: '12px 10px',
                background: holdReq ? 'rgba(245,158,11,0.12)' : surface.control,
                border: `1px solid ${holdReq ? '#D97706' : border.strong}`, borderRadius: radius.md,
              }}
            >
              <span style={{ color: holdReq ? '#FBBF24' : text.secondary, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em' }}>
                {holdReq ? `HOLD REQUESTED ${holdReq.at}` : 'REQUEST DISPATCH HOLD'}
              </span>
              <span style={{ display: 'block', color: text.faint, fontSize: 10, marginTop: 3 }}>
                {holdReq ? 'tap to clear · confirm on radio' : 'urgent alert straight to Control'}
              </span>
            </button>
            <button
              onClick={() => pushToast('error', 'Supervisor escalations ship in phase 2 — use the radio for now')}
              style={{ flex: 1, minWidth: 140, cursor: 'pointer', textAlign: 'center', padding: '12px 10px', background: surface.control, border: `1px solid ${border.strong}`, borderRadius: radius.md }}
            >
              <span style={{ color: text.secondary, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em' }}>ESCALATE TO SUPERVISOR</span>
              <span style={{ display: 'block', color: text.faint, fontSize: 10, marginTop: 3 }}>phase 2 — radio for now</span>
            </button>
            <button
              onClick={() => setIncidentOpen(true)}
              style={{ flex: 1, minWidth: 140, cursor: 'pointer', textAlign: 'center', padding: '12px 10px', background: accent.strong, border: 'none', borderRadius: radius.md }}
            >
              <span style={{ color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em' }}>LOG INCIDENT</span>
              <span style={{ display: 'block', color: 'rgba(255,255,255,0.75)', fontSize: 10, marginTop: 3 }}>
                same form &amp; review flow as Control
              </span>
            </button>
          </div>
        </main>
      )}

      {incidentOpen && attraction && (
        <IncidentForm
          attractionName={attraction.name}
          context="Reported from the Monitor seat"
          onSubmit={handleLogIncident}
          onCancel={() => setIncidentOpen(false)}
        />
      )}

      <ToastStack toasts={toasts} />
    </div>
  );
}

export default function MazeClient() {
  return (
    <Suspense>
      <MazeConsole />
    </Suspense>
  );
}
