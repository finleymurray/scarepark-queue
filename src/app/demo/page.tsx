'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { surface, border, text, accents, radius, microLabel } from '@/lib/theme';

/**
 * /demo — public sales showcase. No auth.
 *
 * Embeds the real, live, public TV + queue screens (via ?preview=1 so the
 * screen-identity hook stands down) so prospective buyers watch genuine
 * real-time updates, alongside framed previews of the three operator apps.
 */

interface DemoAttraction {
  name: string;
  slug: string;
}

const APPS = [
  {
    id: 'control', name: 'Control', href: '/control', glow: '59,130,246',
    blurb: 'Operators run dispatch, queue times and throughput from any phone or tablet — every action stamped to whoever is logged in.',
    points: ['Tap-to-dispatch group clicker', 'Live queue-time stepper', 'PIN operator sign-in & handover'],
  },
  {
    id: 'signoff', name: 'Sign-Off', href: '/signoff', glow: '245,158,11',
    blurb: 'Opening and closing safety checklists signed off by role, on iPads in the dark, with a full audit trail and nightly show reports.',
    points: ['Per-role checklist sign-off', 'Construction & technical reports', 'Exportable A4 PDF records'],
  },
  {
    id: 'admin', name: 'Admin', href: '/admin', glow: '239,68,68',
    blurb: 'Managers see the whole park: live operations, season analytics, operator timelines, user roles and the TV screen fleet.',
    points: ['Live operations dashboard', 'Season analytics & reports', 'Screen pairing & assignment'],
  },
] as const;

const FEATURES = [
  { icon: 'M13 2L3 14h7l-1 8 10-12h-7l1-8z', title: 'Real-time everything', body: 'Queue changes, dispatches and status flow to every screen and device the instant they happen.' },
  { icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11', title: 'Safety sign-offs', body: 'Role-based opening and closing checks with signatures, timestamps and an immutable audit log.' },
  { icon: 'M3 3v18h18M7 14l4-4 3 3 5-6', title: 'Operations analytics', body: 'Throughput, wait trends, downtime and per-operator stats — plus printable nightly reports.' },
  { icon: 'M2 7h20v10H2zM6 21h12', title: 'TV screen fleet', body: 'Wait boards, banners, show times and carousels — paired to any screen with a 4-character code.' },
  { icon: 'M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2', title: 'Operator accountability', body: 'Who ran each attraction and when, with their guests, dispatches and changes for the night.' },
  { icon: 'M4 4h16v12H4zM8 20h8M12 16v4', title: 'Runs on anything', body: 'Phones, tablets and cheap Raspberry Pi screens. No installs — it is all in the browser.' },
];

export default function DemoPage() {
  const [attractions, setAttractions] = useState<DemoAttraction[]>([]);
  const [queueSlug, setQueueSlug] = useState<string>('');

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('attractions')
        .select('name,slug,attraction_type,sort_order')
        .eq('attraction_type', 'ride')
        .order('sort_order');
      if (data && data.length) {
        setAttractions(data);
        setQueueSlug(data[0].slug);
      }
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
          <a href="#live" style={{ ...btn(accents.control.strong, '#fff'), textDecoration: 'none' }}>See it live ↓</a>
          <a href="#apps" style={{ ...btn('transparent', text.primary, true), textDecoration: 'none' }}>Explore the apps</a>
        </div>
      </header>

      {/* ── Live screens ── */}
      <section id="live" style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 24px' }}>
        <SectionLabel kicker="Live, right now" title="Real screens, real data" />
        <p style={{ color: text.secondary, fontSize: 15, lineHeight: 1.6, maxWidth: 640, marginBottom: 28 }}>
          These are the actual guest-facing screens from a working park, streaming live.
          Leave this page open — when the park changes a queue time or status, you&apos;ll see it update here within a second.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, alignItems: 'start' }}>
          {/* TV — widescreen monitor frame */}
          <div>
            <DeviceLabel text="TV4 · Wait times + shows carousel" />
            <div style={{ background: '#000', border: `2px solid ${border.strong}`, borderRadius: 14, padding: 8, boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 8, overflow: 'hidden', background: '#07080B' }}>
                <iframe
                  src="/tv4?preview=1"
                  title="Live TV4 screen"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                />
              </div>
            </div>
            <div style={{ width: 80, height: 10, background: border.strong, borderRadius: '0 0 4px 4px', margin: '0 auto' }} />
            <div style={{ width: 140, height: 6, background: border.default, borderRadius: 3, margin: '0 auto' }} />
          </div>

          {/* Queue entrance — portrait totem frame, attraction-selectable */}
          <div>
            <DeviceLabel text="Queue entrance screen" />
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ background: '#000', border: `2px solid ${border.strong}`, borderRadius: 18, padding: 6, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', flexShrink: 0, marginInline: 'auto' }}>
                <div style={{ position: 'relative', width: 150, aspectRatio: '9 / 16', borderRadius: 12, overflow: 'hidden', background: '#07080B' }}>
                  {queueSlug && (
                    <iframe
                      key={queueSlug}
                      src={`/queue?a=${queueSlug}&preview=1`}
                      title="Live queue screen"
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                    />
                  )}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <p style={{ color: text.muted, fontSize: 12, marginBottom: 8 }}>Pick an attraction:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {attractions.map((a) => (
                    <button
                      key={a.slug}
                      onClick={() => setQueueSlug(a.slug)}
                      style={{
                        textAlign: 'left', padding: '9px 12px', borderRadius: radius.md, cursor: 'pointer', fontSize: 13,
                        background: queueSlug === a.slug ? accents.control.soft : surface.control,
                        border: `1px solid ${queueSlug === a.slug ? accents.control.base : border.default}`,
                        color: queueSlug === a.slug ? text.primary : text.secondary,
                      }}
                    >
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
          <a href="/tv1?preview=1" style={lnk}>wait board</a> · {' '}
          <a href="/tv2?preview=1" style={lnk}>banners</a> · {' '}
          <a href="/tv3?preview=1" style={lnk}>show times</a> · {' '}
          <a href="/tv5?preview=1" style={lnk}>logo montage</a> · {' '}
          <a href="/tv-ops?preview=1" style={lnk}>operations view</a>
        </p>
      </section>

      {/* ── The apps ── */}
      <section id="apps" style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 24px' }}>
        <SectionLabel kicker="Three connected apps" title="One platform, every role" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 24 }}>
          {APPS.map((app) => (
            <div
              key={app.id}
              style={{
                background: `linear-gradient(160deg, rgba(${app.glow},0.10) 0%, ${surface.card} 60%)`,
                border: `1px solid ${border.default}`,
                borderRadius: 16,
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
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
              <a
                href={app.href}
                style={{
                  marginTop: 'auto', textAlign: 'center', textDecoration: 'none',
                  padding: '11px 16px', borderRadius: radius.lg, fontSize: 14, fontWeight: 600,
                  background: `rgb(${app.glow})`, color: '#fff',
                }}
              >
                Open {app.name}
              </a>
            </div>
          ))}
        </div>
        <p style={{ color: text.faint, fontSize: 12, marginTop: 16 }}>
          The operator apps require a login — ask us for demo credentials to take dispatch, sign-offs and analytics for a full test drive.
        </p>
      </section>

      {/* ── Features ── */}
      <section style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 24px 72px' }}>
        <SectionLabel kicker="Why CoreLink" title="Built for live event nights" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginTop: 24 }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{ background: surface.card, border: `1px solid ${border.default}`, borderRadius: radius.lg, padding: 20 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={accents.control.base} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }} aria-hidden>
                <path d={f.icon} />
              </svg>
              <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600 }}>{f.title}</h4>
              <p style={{ color: text.secondary, fontSize: 13, lineHeight: 1.55, margin: 0 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <footer style={{ borderTop: `1px solid ${border.default}`, padding: '40px 24px', textAlign: 'center' }}>
        <h3 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 10px' }}>Want a guided demo for your park?</h3>
        <p style={{ color: text.secondary, fontSize: 15, margin: '0 0 20px' }}>
          We&apos;ll spin up a sandbox with your attractions and walk your team through a full event night.
        </p>
        <a href="mailto:finley@immersivecore.network?subject=CoreLink demo" style={{ ...btn(accents.control.strong, '#fff'), textDecoration: 'none' }}>
          Get in touch
        </a>
        <p style={{ ...microLabel, marginTop: 28 }}>CoreLink · Immersive Core</p>
      </footer>
    </div>
  );
}

const lnk: React.CSSProperties = { color: text.secondary, textDecoration: 'underline', textUnderlineOffset: 3 };

function btn(bg: string, color: string, outline = false): React.CSSProperties {
  return {
    display: 'inline-block', padding: '12px 22px', borderRadius: radius.lg, fontSize: 15, fontWeight: 600,
    background: bg, color, cursor: 'pointer',
    border: outline ? `1px solid ${border.strong}` : 'none',
  };
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
