'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { surface, border, text, accents, radius, microLabel, FONT_NUM, statusColors } from '@/lib/theme';
import type { AttractionStatus } from '@/types/database';

/**
 * /demo — public sales showcase. No auth.
 *
 * - Live embeds of the real public TV + queue screens (via ?preview=1).
 * - A self-contained interactive Control → queue-screen demo (local state,
 *   no DB writes — safe on a public page, can't touch the live park).
 * - Visual feature spotlights for Sign-Off, Operations and Reports.
 */

interface DemoAttraction { name: string; slug: string; }

const APPS = [
  { id: 'control', name: 'Control', href: '/control', glow: '59,130,246',
    blurb: 'Operators run dispatch, queue times and throughput from any phone or tablet — every action stamped to whoever is logged in.',
    points: ['Tap-to-dispatch group clicker', 'Live queue-time stepper', 'PIN operator sign-in & handover'] },
  { id: 'signoff', name: 'Sign-Off', href: '/signoff', glow: '245,158,11',
    blurb: 'Opening and closing safety checklists signed off by role, on iPads in the dark, with a full audit trail and nightly show reports.',
    points: ['Per-role checklist sign-off', 'Construction & technical reports', 'Exportable A4 PDF records'] },
  { id: 'admin', name: 'Admin', href: '/admin', glow: '239,68,68',
    blurb: 'Managers see the whole park: live operations, season analytics, operator timelines, user roles and the TV screen fleet.',
    points: ['Live operations dashboard', 'Season analytics & reports', 'Screen pairing & assignment'] },
] as const;

const lnk: React.CSSProperties = { color: text.secondary, textDecoration: 'underline', textUnderlineOffset: 3 };

export default function DemoPage() {
  const [attractions, setAttractions] = useState<DemoAttraction[]>([]);
  const [queueSlug, setQueueSlug] = useState('');

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('attractions')
        .select('name,slug,attraction_type,sort_order')
        .eq('attraction_type', 'ride')
        .order('sort_order');
      if (data && data.length) { setAttractions(data); setQueueSlug(data[0].slug); }
    }
    load();
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: surface.page, color: text.primary }}>
      {/* ── Hero ── */}
      <header style={{ maxWidth: 980, margin: '0 auto', padding: '64px 24px 32px', textAlign: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="CoreLink" style={{ width: 56, height: 56, objectFit: 'contain', marginBottom: 18 }} />
        <p style={{ ...microLabel, marginBottom: 14 }}>CoreLink Operations Platform</p>
        <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em', margin: 0, lineHeight: 1.05 }}>
          Run your scare park<br />like clockwork.
        </h1>
        <p style={{ color: text.secondary, fontSize: 17, lineHeight: 1.6, maxWidth: 620, margin: '20px auto 0' }}>
          Live queue times, dispatch control, safety sign-offs and guest-facing screens —
          one connected system, updating in real time across every device in the park.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 28 }}>
          <a href="#try" style={{ ...btn(accents.control.strong, '#fff'), textDecoration: 'none' }}>Try it yourself ↓</a>
          <a href="#apps" style={{ ...btn('transparent', text.primary, true), textDecoration: 'none' }}>Explore the apps</a>
        </div>
      </header>

      {/* ── Interactive demo ── */}
      <section id="try" style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 24px' }}>
        <SectionLabel kicker="Hands on" title="Change the queue. Watch the screen." />
        <p style={{ color: text.secondary, fontSize: 15, lineHeight: 1.6, maxWidth: 640, marginBottom: 28 }}>
          This is exactly how an operator runs an attraction. Set a status or adjust the wait —
          the guest-facing entrance screen on the right updates the instant you do.
        </p>
        <InteractiveDemo />
      </section>

      {/* ── Live screens ── */}
      <section id="live" style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 24px' }}>
        <SectionLabel kicker="Live, right now" title="Real screens, real data" />
        <p style={{ color: text.secondary, fontSize: 15, lineHeight: 1.6, maxWidth: 640, marginBottom: 28 }}>
          These are the actual guest-facing screens from a working park, streaming live.
          Leave this open — when the park changes a queue time or status, you&apos;ll see it update here within a second.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, alignItems: 'start' }}>
          <div>
            <DeviceLabel text="TV4 · Wait times + shows carousel" />
            <div style={{ background: '#000', border: `2px solid ${border.strong}`, borderRadius: 14, padding: 8, boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 8, overflow: 'hidden', background: '#07080B' }}>
                <iframe src="/tv4?preview=1" title="Live TV4 screen" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} />
              </div>
            </div>
          </div>

          <div>
            <DeviceLabel text="Queue entrance screen" />
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ background: '#000', border: `2px solid ${border.strong}`, borderRadius: 18, padding: 6, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', flexShrink: 0, marginInline: 'auto' }}>
                <div style={{ position: 'relative', width: 150, aspectRatio: '9 / 16', borderRadius: 12, overflow: 'hidden', background: '#07080B' }}>
                  {queueSlug && <iframe key={queueSlug} src={`/queue?a=${queueSlug}&preview=1`} title="Live queue screen" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} />}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <p style={{ color: text.muted, fontSize: 12, marginBottom: 8 }}>Pick an attraction:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {attractions.map((a) => (
                    <button key={a.slug} onClick={() => setQueueSlug(a.slug)}
                      style={{
                        textAlign: 'left', padding: '9px 12px', borderRadius: radius.md, cursor: 'pointer', fontSize: 13,
                        background: queueSlug === a.slug ? accents.control.soft : surface.control,
                        border: `1px solid ${queueSlug === a.slug ? accents.control.base : border.default}`,
                        color: queueSlug === a.slug ? text.primary : text.secondary,
                      }}>
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <p style={{ color: text.faint, fontSize: 12, marginTop: 20 }}>
          More screen styles: {' '}
          <a href="/tv1?preview=1" style={lnk}>wait board</a> · <a href="/tv2?preview=1" style={lnk}>banners</a> · {' '}
          <a href="/tv3?preview=1" style={lnk}>show times</a> · <a href="/tv5?preview=1" style={lnk}>logo montage</a> · {' '}
          <a href="/tv-ops?preview=1" style={lnk}>operations view</a>
        </p>
      </section>

      {/* ── Feature spotlights ── */}
      <section style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 24px' }}>
        <SectionLabel kicker="What's inside" title="More than queue times" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 28 }}>
          <Spotlight
            glow="245,158,11"
            kicker="Sign-Off"
            title="Safety checks that hold up to scrutiny"
            body="Opening and closing checklists are signed off by role on iPads in the dark. Every sign-off captures who, when and a signature — and rolls into a nightly report."
            points={['Per-role PIN sign-off', 'Construction, technical & costume notes', 'Immutable audit trail']}
            visual={<SignoffVisual />}
          />
          <Spotlight
            glow="239,68,68"
            kicker="Operations"
            title="The whole park on one board"
            body="A live operations view shows every attraction's status, current operator, why anything is delayed, guests through, sign-off state and downtime — updating in real time."
            points={['Live operator & delay tracking', 'Downtime counters', 'Queue-time trend charts']}
            visual={<OpsVisual />}
            reverse
          />
          <Spotlight
            glow="59,130,246"
            kicker="Reports"
            title="A printable record of every night"
            body="Show and operations reports generate per attraction — guests, throughput by hour, delays with reasons, operator shifts and sign-offs — exportable as clean A4 PDFs."
            points={['One page per attraction', 'Show + operations reports', 'Export & print for records']}
            visual={<ReportVisual />}
          />
        </div>
      </section>

      {/* ── The apps ── */}
      <section id="apps" style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 24px' }}>
        <SectionLabel kicker="Three connected apps" title="One platform, every role" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 24 }}>
          {APPS.map((app) => (
            <div key={app.id} style={{ background: `linear-gradient(160deg, rgba(${app.glow},0.10) 0%, ${surface.card} 60%)`, border: `1px solid ${border.default}`, borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/logo-${app.id}.png`} alt="" style={{ width: 30, height: 30, objectFit: 'contain', filter: `drop-shadow(0 0 8px rgba(${app.glow},0.5))` }} />
                <h3 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '-0.01em' }}>{app.name}</h3>
              </div>
              <p style={{ color: text.secondary, fontSize: 14, lineHeight: 1.55, margin: '0 0 16px' }}>{app.blurb}</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {app.points.map((p) => (
                  <li key={p} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: text.secondary, fontSize: 13 }}>
                    <span style={{ color: `rgb(${app.glow})`, flexShrink: 0 }}>✓</span> {p}
                  </li>
                ))}
              </ul>
              <a href={app.href} style={{ marginTop: 'auto', textAlign: 'center', textDecoration: 'none', padding: '11px 16px', borderRadius: radius.lg, fontSize: 14, fontWeight: 600, background: `rgb(${app.glow})`, color: '#fff' }}>
                Open {app.name}
              </a>
            </div>
          ))}
        </div>
        <p style={{ color: text.faint, fontSize: 12, marginTop: 16 }}>
          The operator apps require a login — ask us for demo credentials to take dispatch, sign-offs and analytics for a full test drive.
        </p>
      </section>

      {/* ── Footer CTA ── */}
      <footer style={{ borderTop: `1px solid ${border.default}`, padding: '40px 24px', textAlign: 'center' }}>
        <h3 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 10px' }}>Want a guided demo for your park?</h3>
        <p style={{ color: text.secondary, fontSize: 15, margin: '0 0 20px' }}>
          We&apos;ll spin up a sandbox with your attractions and walk your team through a full event night.
        </p>
        <a href="mailto:finley@immersivecore.network?subject=CoreLink demo" style={{ ...btn(accents.control.strong, '#fff'), textDecoration: 'none' }}>Get in touch</a>
        <p style={{ ...microLabel, marginTop: 28 }}>CoreLink · Immersive Core</p>
      </footer>
    </div>
  );
}

/* ── Interactive Control → queue-screen demo (local state, no DB) ── */

const DEMO_GLOW = '168,85,247';
const DEMO_COLOR = '#C4B5FD';
const DELAY_REASONS = ['Technical', 'E-Stop', 'Weather', 'Staffing'] as const;

function InteractiveDemo() {
  const [status, setStatus] = useState<AttractionStatus>('OPEN');
  const [wait, setWait] = useState(25);
  const [reason, setReason] = useState<(typeof DELAY_REASONS)[number]>('Technical');

  const adjust = (d: number) => setWait((w) => Math.max(0, Math.min(300, w + d)));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1.4fr) minmax(220px, 1fr)', gap: 24, alignItems: 'start' }}>
      {/* Control panel */}
      <div style={{ background: surface.card, border: `1px solid ${border.default}`, borderRadius: 16, padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-control.png" alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>Control · The Cellar</span>
          <span style={{ marginLeft: 'auto', ...microLabel, color: accents.control.text }}>Demo operator</span>
        </div>

        {/* Status buttons */}
        <p style={{ ...microLabel, marginBottom: 8 }}>Status</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 18 }}>
          {(['OPEN', 'DELAYED', 'AT CAPACITY', 'CLOSED'] as AttractionStatus[]).map((s) => {
            const c = statusColors(s);
            const active = status === s;
            return (
              <button key={s} onClick={() => setStatus(s)}
                style={{
                  padding: '12px 8px', borderRadius: radius.md, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                  background: active ? c.soft : surface.control,
                  border: `1px solid ${active ? c.rail : border.default}`,
                  color: active ? c.text : text.muted,
                }}>
                {s}
              </button>
            );
          })}
        </div>

        {/* Queue stepper / reason */}
        {status === 'OPEN' || status === 'AT CAPACITY' ? (
          <>
            <p style={{ ...microLabel, marginBottom: 8 }}>Queue time</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {[-10, -5].map((d) => (
                <button key={d} onClick={() => adjust(d)} style={stepBtn('#F87171')}>{d}</button>
              ))}
              <div style={{ flex: 1, textAlign: 'center' }}>
                <span style={{ fontSize: 32, fontWeight: 800, ...FONT_NUM }}>{wait}</span>
                <span style={{ color: text.muted, fontSize: 13, marginLeft: 4 }}>min</span>
              </div>
              {[5, 10].map((d) => (
                <button key={d} onClick={() => adjust(d)} style={stepBtn('#4ADE80')}>+{d}</button>
              ))}
            </div>
          </>
        ) : status === 'DELAYED' ? (
          <>
            <p style={{ ...microLabel, marginBottom: 8 }}>Delay reason</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {DELAY_REASONS.map((r) => (
                <button key={r} onClick={() => setReason(r)}
                  style={{
                    padding: '9px 14px', borderRadius: radius.md, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    background: reason === r ? 'rgba(245,158,11,0.12)' : surface.control,
                    border: `1px solid ${reason === r ? '#F59E0B' : border.default}`,
                    color: reason === r ? '#FCD34D' : text.muted,
                  }}>
                  {r}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p style={{ color: text.muted, fontSize: 13, padding: '10px 0' }}>Attraction is closed to guests.</p>
        )}

        <p style={{ ...microLabel, color: accents.control.text, marginTop: 18, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
          Updates the screen instantly
        </p>
      </div>

      {/* Live queue-screen preview */}
      <div>
        <DeviceLabel text="Entrance screen" />
        <div style={{ background: '#000', border: `2px solid ${border.strong}`, borderRadius: 18, padding: 6, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', width: 'fit-content', marginInline: 'auto' }}>
          <div style={{
            position: 'relative', width: 190, aspectRatio: '9 / 16', borderRadius: 12, overflow: 'hidden',
            background: `radial-gradient(ellipse at 50% 35%, rgba(${DEMO_GLOW},0.18), #07080B 70%)`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 12, textAlign: 'center',
          }}>
            <span style={{ position: 'absolute', top: 14, ...microLabel, color: DEMO_COLOR, fontSize: 11 }}>The Cellar</span>
            {status === 'OPEN' && (
              <>
                <span style={{ fontSize: 84, fontWeight: 900, lineHeight: 0.9, color: DEMO_COLOR, ...FONT_NUM, textShadow: `0 0 30px rgba(${DEMO_GLOW},0.6)` }}>{wait}</span>
                <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.3em', color: DEMO_COLOR, marginTop: 6 }}>MINUTES</span>
              </>
            )}
            {status === 'AT CAPACITY' && <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '0.06em', color: '#FBBF24' }}>AT CAPACITY</span>}
            {status === 'DELAYED' && <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '0.05em', color: '#FBBF24', lineHeight: 1.2 }}>TECHNICAL<br />DELAY</span>}
            {status === 'CLOSED' && <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '0.06em', color: '#F87171' }}>CLOSED</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function stepBtn(color: string): React.CSSProperties {
  return {
    width: 52, height: 52, borderRadius: radius.md, cursor: 'pointer', flexShrink: 0,
    background: surface.control, border: `1px solid ${border.strong}`, color, fontSize: 16, fontWeight: 800,
  };
}

/* ── Feature spotlight (mock visual + copy, alternating sides) ── */

function Spotlight({ glow, kicker, title, body, points, visual, reverse = false }: {
  glow: string; kicker: string; title: string; body: string; points: string[]; visual: React.ReactNode; reverse?: boolean;
}) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 28, alignItems: 'center',
      background: `linear-gradient(${reverse ? '255deg' : '105deg'}, rgba(${glow},0.08) 0%, ${surface.card} 55%)`,
      border: `1px solid ${border.default}`, borderRadius: 18, padding: 28,
    }}>
      <div style={{ order: reverse ? 2 : 1 }}>
        <p style={{ ...microLabel, color: `rgb(${glow})`, marginBottom: 8 }}>{kicker}</p>
        <h3 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 12px' }}>{title}</h3>
        <p style={{ color: text.secondary, fontSize: 15, lineHeight: 1.6, margin: '0 0 16px' }}>{body}</p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {points.map((p) => (
            <li key={p} style={{ display: 'flex', gap: 8, color: text.secondary, fontSize: 14 }}>
              <span style={{ color: `rgb(${glow})` }}>✓</span> {p}
            </li>
          ))}
        </ul>
      </div>
      <div style={{ order: reverse ? 1 : 2 }}>{visual}</div>
    </div>
  );
}

function SignoffVisual() {
  return (
    <div style={{ background: surface.page, border: `1px solid ${border.default}`, borderRadius: 14, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Technical</span>
        <span style={{ color: '#FCD34D', fontSize: 11, fontWeight: 600 }}>2 of 3</span>
      </div>
      {[['Emergency lighting test', true], ['Fire exits clear', true], ['Comms check', false]].map(([label, on]) => (
        <div key={label as string} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: surface.control, borderRadius: 10, padding: '10px 12px', marginBottom: 6 }}>
          <span style={{ color: text.secondary, fontSize: 12 }}>{label as string}</span>
          <div style={{ width: 36, height: 20, borderRadius: 11, background: on ? '#22C55E' : '#1C1F26', border: on ? 'none' : `1px solid ${border.strong}`, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 2, [on ? 'right' : 'left']: 2, width: 16, height: 16, borderRadius: '50%', background: on ? '#fff' : '#475569' }} />
          </div>
        </div>
      ))}
      <div style={{ marginTop: 10, borderRadius: 12, border: '1px solid rgba(34,197,94,0.25)', background: 'rgba(34,197,94,0.06)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#4ADE80' }}>✓</span>
        <div>
          <div style={{ color: '#86EFAC', fontSize: 12, fontWeight: 600 }}>Show & actors</div>
          <div style={{ color: '#4D7C5F', fontSize: 10 }}>Maya R · 18:42</div>
        </div>
      </div>
    </div>
  );
}

function OpsVisual() {
  return (
    <div style={{ background: surface.card, border: `1px solid ${border.default}`, borderLeft: '3px solid #F59E0B', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Drowned</span>
        <span style={{ background: 'rgba(245,158,11,0.12)', color: '#FBBF24', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>DELAYED</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: accents.control.strong, color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>JH</div>
        <span style={{ color: text.secondary, fontSize: 12 }}>Jake Hollis</span>
      </div>
      <div style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
        <div style={{ ...microLabel, color: '#FBBF24' }}>Down for</div>
        <div style={{ color: '#FBBF24', fontSize: 22, fontWeight: 800, ...FONT_NUM }}>04:18</div>
        <div style={{ color: '#FBBF24', fontSize: 11, marginTop: 2 }}>E-Stop</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Stat label="Guests" value="412" />
        <Stat label="Downtime" value="11m" color="#FBBF24" />
        <Stat label="Opening" value="✓" color="#4ADE80" />
        <Stat label="Closing" value="—" color={text.faint} />
      </div>
    </div>
  );
}

function Stat({ label, value, color = text.primary }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={microLabel}>{label}</div>
      <div style={{ color, fontSize: 15, fontWeight: 600, ...FONT_NUM }}>{value}</div>
    </div>
  );
}

function ReportVisual() {
  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: 18, color: '#111', boxShadow: '0 16px 40px rgba(0,0,0,0.4)', maxWidth: 280, marginInline: 'auto', aspectRatio: '210 / 297', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd', paddingBottom: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em' }}>OPERATIONS REPORT</span>
        <span style={{ fontSize: 9, color: '#888' }}>Drowned · 31 Oct</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 14 }}>
        {[['Guests', '412'], ['Avg wait', '38m'], ['Downtime', '11m'], ['Dispatches', '68'], ['Peak', '55m'], ['Open', '4h']].map(([l, v]) => (
          <div key={l} style={{ border: '1px solid #eee', borderRadius: 4, padding: '6px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: 7, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 8, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Hourly throughput</div>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', padding: '4px 0', fontSize: 9 }}>
          <span style={{ color: '#555' }}>{6 + i}:00 PM</span>
          <span style={{ color: '#111', fontWeight: 600 }}>{[88, 104, 96, 124][i - 1]}</span>
        </div>
      ))}
    </div>
  );
}

/* ── shared bits ── */

function btn(bg: string, color: string, outline = false): React.CSSProperties {
  return { display: 'inline-block', padding: '12px 22px', borderRadius: radius.lg, fontSize: 15, fontWeight: 600, background: bg, color, cursor: 'pointer', border: outline ? `1px solid ${border.strong}` : 'none' };
}

function SectionLabel({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <p style={{ ...microLabel, color: accents.control.text, marginBottom: 8 }}>{kicker}</p>
      <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>{title}</h2>
    </div>
  );
}

function DeviceLabel({ text: t }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E' }} />
      <span style={{ ...microLabel, color: text.secondary }}>{t}</span>
    </div>
  );
}
