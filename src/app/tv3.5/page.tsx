'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { getAttractionLogo, getAttractionBg } from '@/lib/logos';
import type { Attraction, ParkSetting } from '@/types/database';

function formatTime12h(time: string): string {
  if (!time) return '--:--';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${m} ${ampm}`;
}

/* ── Fear ratings — hardcoded 1-6 Scream Skull scale, mazes only ── */
const FEAR_RATINGS: Record<string, number> = {
  'night-terrors': 6,
  'drowned': 5,
  'westlake-witch-trials': 4,
  'the-bunker': 3,
  'strings-of-control': 2,
  'signal-loss': 1,
};

/* ── Maze loglines ── */
const MAZE_LOGLINES: Record<string, string> = {
  'night-terrors': "The lights are off. The door is closed. You're not alone.",
  'drowned': 'A damaged vessel drifts in black waters as sirens infect the crew one by one.',
  'westlake-witch-trials': 'A neon-soaked town gripped by 80s satanic panic has found its witches.',
  'the-bunker': 'The Whitmore family survived the apocalypse in luxury \u2014 and kept their favourite tradition alive.',
  'strings-of-control': 'Behind the velvet curtains, something else is pulling the strings.',
  'signal-loss': 'The broadcast went dead at 2:17am \u2014 but something is still transmitting.',
};

const MAX_SKULLS = 6;
const TV_SAFE_PADDING = '3.5%';

/* ── Inline SVG skull path (matches the symbol from the mockup) ── */
const SKULL_PATH =
  'M12 2C7.03 2 3 5.58 3 10c0 2.07.86 3.95 2.25 5.33V18a1 1 0 0 0 1 1h1.5v2a1 1 0 0 0 1 1h1.5a1 1 0 0 0 1-1v-2h1.5v2a1 1 0 0 0 1 1h1.5a1 1 0 0 0 1-1v-2h1.5a1 1 0 0 0 1-1v-2.67C20.14 13.95 21 12.07 21 10c0-4.42-4.03-8-9-8z';

function SkullIcon({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{
        flexShrink: 0,
        opacity: filled ? 1 : 0.15,
        filter: filled
          ? 'drop-shadow(0 0 3px rgba(220,38,38,0.8)) drop-shadow(0 0 6px rgba(220,38,38,0.4))'
          : 'none',
      }}
    >
      <path d={SKULL_PATH} fill="#DC2626" />
      <circle cx="9" cy="10" r="2" fill="#0a0a0a" />
      <circle cx="15" cy="10" r="2" fill="#0a0a0a" />
      <path d="M12 13.5l-1 1.5h2l-1-1.5z" fill="#0a0a0a" />
      <line x1="8" y1="17" x2="16" y2="17" stroke="#0a0a0a" strokeWidth="0.5" />
      <line x1="10" y1="16" x2="10" y2="18" stroke="#0a0a0a" strokeWidth="0.4" />
      <line x1="12" y1="16" x2="12" y2="18" stroke="#0a0a0a" strokeWidth="0.4" />
      <line x1="14" y1="16" x2="14" y2="18" stroke="#0a0a0a" strokeWidth="0.4" />
    </svg>
  );
}

function SkullRow({ count, size }: { count: number; size: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3vw' }}>
      {Array.from({ length: MAX_SKULLS }, (_, i) => (
        <SkullIcon key={i} filled={i < count} size={size} />
      ))}
    </div>
  );
}

/* ── Lightning bolt generation (mirrors the mockup) ── */
function generateBolt(width: number, y: number, segments: number, jitter: number): string {
  const segW = width / segments;
  let d = `M 0 ${y}`;
  let prevY = y;
  for (let i = 1; i < segments; i++) {
    const x = i * segW;
    const direction = Math.random() > 0.5 ? 1 : -1;
    const spike = direction * (Math.random() * jitter * 0.7 + jitter * 0.3);
    const newY = Math.max(y - jitter, Math.min(y + jitter, prevY + spike));
    d += ` L ${x.toFixed(1)} ${newY.toFixed(1)}`;
    prevY = newY;
  }
  d += ` L ${width} ${y}`;
  return d;
}

function generateBranch(startX: number, startY: number, length: number, angle: number): string {
  const segments = 3 + Math.floor(Math.random() * 3);
  const segLen = length / segments;
  let d = `M ${startX.toFixed(1)} ${startY.toFixed(1)}`;
  let cx = startX, cy = startY;
  for (let i = 0; i < segments; i++) {
    const jitterAngle = angle + (Math.random() - 0.5) * 0.8;
    cx += Math.cos(jitterAngle) * segLen;
    cy += Math.sin(jitterAngle) * segLen;
    d += ` L ${cx.toFixed(1)} ${cy.toFixed(1)}`;
  }
  return d;
}

function LightningBorder() {
  const [key, setKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setKey((k) => k + 1), 2500);
    return () => clearInterval(interval);
  }, []);

  const svgContent = useMemo(() => {
    const w = 1000;
    const h = 10;
    const cy = h / 2;
    const bolt1 = generateBolt(w, cy, 80, 4);
    const bolt2 = generateBolt(w, cy, 65, 3);
    const bolt3 = generateBolt(w, cy, 50, 3.5);

    const branches: { d: string; cls: string }[] = [];
    for (let i = 0; i < 6; i++) {
      const bx = 80 + Math.random() * 840;
      const by = cy + (Math.random() - 0.5) * 3;
      const angle = (Math.random() > 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.8);
      const len = 8 + Math.random() * 14;
      branches.push({ d: generateBranch(bx, by, len, angle), cls: `b${(i % 6) + 1}` });
    }

    const sparks: { cx: number; cy: number }[] = [];
    for (let i = 0; i < 5; i++) {
      sparks.push({ cx: 80 + Math.random() * 840, cy: cy + (Math.random() - 0.5) * 3 });
    }

    return { bolt1, bolt2, bolt3, branches, sparks };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '10px',
        flexShrink: 0,
        overflow: 'visible',
      }}
    >
      <svg
        viewBox="0 0 1000 10"
        preserveAspectRatio="none"
        style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible' }}
      >
        <style>{`
          .b-core { fill:none; stroke-width:1.4; stroke-linecap:round; stroke-linejoin:bevel; animation:bp 1.8s ease-in-out infinite; }
          .b-glow { fill:none; stroke-width:4; stroke-linecap:round; stroke-linejoin:round; opacity:0.45; filter:url(#blur2); animation:bpg 1.8s ease-in-out infinite; }
          .b-amb  { fill:none; stroke-width:10; stroke-linecap:round; stroke-linejoin:round; opacity:0.15; filter:url(#blur5); animation:bpa 1.8s ease-in-out infinite; }
          .b-hot  { fill:none; stroke-width:0.6; stroke-linecap:round; stroke-linejoin:bevel; stroke:#fff; opacity:0.85; animation:bhp 1.2s ease-in-out infinite; }
          .b-br   { fill:none; stroke-width:0.7; stroke-linecap:round; stroke-linejoin:bevel; opacity:0; animation:bf 2s ease-in-out infinite; }
          .b-brg  { fill:none; stroke-width:2.5; stroke-linecap:round; stroke-linejoin:round; opacity:0; filter:url(#blur1); animation:bfg 2s ease-in-out infinite; }
          .s2 .b-core,.s2 .b-glow,.s2 .b-amb,.s2 .b-hot { animation-delay:0.6s; }
          .s3 .b-core,.s3 .b-glow,.s3 .b-amb,.s3 .b-hot { animation-delay:1.2s; }
          .b1 { animation-delay:0s; } .b2 { animation-delay:0.7s; } .b3 { animation-delay:1.3s; }
          .b4 { animation-delay:0.3s; } .b5 { animation-delay:1.8s; } .b6 { animation-delay:0.9s; }
          @keyframes bp { 0%{stroke:#8B5CF6;opacity:1}10%{stroke:#c4b5fd;opacity:1}20%{stroke:#60a5fa;opacity:0.95}35%{stroke:#fff;opacity:1}50%{stroke:#a78bfa;opacity:1}65%{stroke:#818cf8;opacity:0.95}80%{stroke:#c084fc;opacity:1}100%{stroke:#8B5CF6;opacity:1} }
          @keyframes bpg { 0%{stroke:#8B5CF6;opacity:0.5}10%{stroke:#c4b5fd;opacity:0.7}20%{stroke:#60a5fa;opacity:0.55}35%{stroke:#e0e7ff;opacity:0.75}50%{stroke:#a78bfa;opacity:0.6}65%{stroke:#818cf8;opacity:0.55}80%{stroke:#c084fc;opacity:0.65}100%{stroke:#8B5CF6;opacity:0.5} }
          @keyframes bpa { 0%{stroke:#7c3aed;opacity:0.18}25%{stroke:#60a5fa;opacity:0.28}50%{stroke:#c084fc;opacity:0.22}75%{stroke:#818cf8;opacity:0.25}100%{stroke:#7c3aed;opacity:0.18} }
          @keyframes bhp { 0%,100%{opacity:0.7}25%{opacity:1}50%{opacity:0.5}75%{opacity:0.9} }
          @keyframes bf { 0%,100%{opacity:0;stroke:#8B5CF6}3%{opacity:1;stroke:#fff}6%{opacity:0.15;stroke:#a78bfa}9%{opacity:0.85;stroke:#e0e7ff}14%{opacity:0.4;stroke:#c4b5fd}20%{opacity:0;stroke:#8B5CF6} }
          @keyframes bfg { 0%,100%{opacity:0;stroke:#7c3aed}3%{opacity:0.6;stroke:#c4b5fd}6%{opacity:0.1;stroke:#8B5CF6}9%{opacity:0.5;stroke:#a78bfa}14%{opacity:0.2;stroke:#8B5CF6}20%{opacity:0;stroke:#7c3aed} }
        `}</style>
        <defs>
          <filter id="blur1"><feGaussianBlur stdDeviation="1.5" /></filter>
          <filter id="blur2"><feGaussianBlur stdDeviation="2" /></filter>
          <filter id="blur5"><feGaussianBlur stdDeviation="5" /></filter>
        </defs>
        {/* Ambient */}
        <path className="b-amb" d={svgContent.bolt1} />
        <path className="b-amb s2" d={svgContent.bolt2} />
        {/* Glow */}
        <path className="b-glow" d={svgContent.bolt1} />
        <path className="b-glow s2" d={svgContent.bolt2} />
        <path className="b-glow s3" d={svgContent.bolt3} />
        {/* Core */}
        <path className="b-core" d={svgContent.bolt1} />
        <path className="b-core s2" d={svgContent.bolt2} />
        <path className="b-core s3" d={svgContent.bolt3} />
        {/* Hot */}
        <path className="b-hot" d={svgContent.bolt1} />
        {/* Branches */}
        {svgContent.branches.map((b, i) => (
          <React.Fragment key={i}>
            <path className={`b-brg ${b.cls}`} d={b.d} />
            <path className={`b-br ${b.cls}`} d={b.d} />
          </React.Fragment>
        ))}
        {/* Sparks */}
        {svgContent.sparks.map((s, i) => (
          <circle key={i} fill="#fff" cx={s.cx} cy={s.cy} r={1} opacity={0}>
            <animate attributeName="opacity" values="0;1;0.2;0.9;0" dur={`${(1.5 + Math.random() * 1.5).toFixed(1)}s`} repeatCount="indefinite" begin={`${(Math.random() * 2).toFixed(1)}s`} />
            <animate attributeName="r" values="0.5;2;1;1.5;0.5" dur={`${(1.5 + Math.random() * 1.5).toFixed(1)}s`} repeatCount="indefinite" begin={`${(Math.random() * 2).toFixed(1)}s`} />
          </circle>
        ))}
      </svg>
    </div>
  );
}

/* ── Fear card component ── */
const FearCard = React.memo(function FearCard({
  attraction,
  rank,
  skullSize,
}: {
  attraction: Attraction;
  rank: number;
  skullSize: number;
}) {
  const rating = FEAR_RATINGS[attraction.slug] ?? 0;
  const logline = MAZE_LOGLINES[attraction.slug] ?? '';
  const logoSrc = getAttractionLogo(attraction.slug);
  const bgSrc = getAttractionBg(attraction.slug);

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '0.6vw',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)',
      }}
    >
      {/* Background art */}
      {bgSrc && (
        <img
          src={bgSrc}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center center',
          }}
        />
      )}
      {/* Gradient overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.6) 40%, rgba(0,0,0,0.25) 70%, transparent 100%)',
          zIndex: 1,
        }}
      />
      {/* Rank number */}
      <span
        style={{
          position: 'absolute',
          top: '0.4vw',
          right: '0.6vw',
          zIndex: 3,
          fontSize: '2.2vw',
          fontWeight: 900,
          color: 'rgba(255,255,255,0.08)',
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        #{rank}
      </span>
      {/* Logo */}
      {logoSrc && (
        <img
          src={logoSrc}
          alt={attraction.name}
          style={{
            position: 'absolute',
            left: '0.6vw',
            top: '0.4vw',
            zIndex: 3,
            height: '35%',
            width: 'auto',
            maxWidth: '65%',
            objectFit: 'contain',
            objectPosition: 'left top',
            opacity: 0.85,
          }}
        />
      )}
      {/* Content at bottom */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          padding: '0 0.8vw 0.6vw',
          marginTop: 'auto',
          minHeight: '5vw',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}
      >
        <div
          style={{
            fontSize: '0.9vw',
            fontWeight: 800,
            color: '#fff',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '0.2vw',
          }}
        >
          {attraction.name}
        </div>
        <div
          style={{
            fontSize: '0.6vw',
            lineHeight: 1.35,
            color: 'rgba(255,255,255,0.45)',
            marginBottom: '0.4vw',
          }}
        >
          {logline}
        </div>
        <SkullRow count={rating} size={skullSize} />
      </div>
    </div>
  );
});

/* ── Main page ── */

export default function TV35ScreamMeter() {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [closingTime, setClosingTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [isEmbedded, setIsEmbedded] = useState(false);

  useEffect(() => {
    setIsEmbedded(window.self !== window.top);
  }, []);

  useEffect(() => {
    async function fetchData() {
      const [attractionsRes, closingRes] = await Promise.all([
        supabase
          .from('attractions')
          .select('id,name,slug,status,wait_time,sort_order,attraction_type,show_times,updated_at')
          .order('sort_order', { ascending: true }),
        supabase.from('park_settings').select('key,value').eq('key', 'closing_time').single(),
      ]);

      if (!attractionsRes.error) {
        setAttractions(attractionsRes.data || []);
      }
      if (closingRes.data) {
        setClosingTime(closingRes.data.value);
      }
      setLoading(false);
    }

    fetchData();

    const attractionsChannel = supabase
      .channel('tv35-attractions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attractions' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setAttractions((prev) =>
              prev.map((a) =>
                a.id === (payload.new as Attraction).id ? (payload.new as Attraction) : a,
              ),
            );
          } else if (payload.eventType === 'INSERT') {
            setAttractions((prev) =>
              [...prev, payload.new as Attraction].sort((a, b) => a.sort_order - b.sort_order),
            );
          } else if (payload.eventType === 'DELETE') {
            setAttractions((prev) =>
              prev.filter((a) => a.id !== (payload.old as Attraction).id),
            );
          }
        },
      )
      .subscribe();

    const settingsChannel = supabase
      .channel('tv35-settings')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'park_settings' },
        (payload) => {
          const setting = payload.new as ParkSetting;
          if (setting.key === 'closing_time') {
            setClosingTime(setting.value);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(attractionsChannel);
      supabase.removeChannel(settingsChannel);
    };
  }, []);

  /* Filter to mazes that have fear ratings, sorted by rating descending */
  const ratedMazes = useMemo(() => {
    return attractions
      .filter((a) => a.attraction_type !== 'show' && FEAR_RATINGS[a.slug] !== undefined)
      .sort((a, b) => (FEAR_RATINGS[b.slug] ?? 0) - (FEAR_RATINGS[a.slug] ?? 0));
  }, [attractions]);

  /* Preload images */
  useEffect(() => {
    ratedMazes.forEach((a) => {
      const bg = getAttractionBg(a.slug);
      const logo = getAttractionLogo(a.slug);
      if (bg) {
        const img = new Image();
        img.src = bg;
      }
      if (logo) {
        const img = new Image();
        img.src = logo;
      }
    });
  }, [ratedMazes]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <h1 className="text-white/60 text-2xl font-semibold">Loading...</h1>
      </div>
    );
  }

  /* Responsive skull size — vw-based */
  const skullSize = isEmbedded ? 14 : 18;

  return (
    <div
      className="h-screen bg-black flex flex-col overflow-hidden"
      style={{
        paddingLeft: isEmbedded ? 0 : TV_SAFE_PADDING,
        paddingRight: isEmbedded ? 0 : TV_SAFE_PADDING,
        paddingTop: isEmbedded ? 0 : '2%',
        paddingBottom: isEmbedded ? 0 : '2%',
      }}
    >
      {/* Header */}
      {!isEmbedded && (
        <div
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            padding: '1.5vw 0',
            textAlign: 'center',
            marginBottom: '0.8vw',
            flexShrink: 0,
          }}
        >
          <h1
            style={{
              fontSize: '2.2vw',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              color: '#fff',
              margin: 0,
            }}
          >
            The Scream Meter
          </h1>
          <LightningBorder />
        </div>
      )}

      {/* Fear grid */}
      <main className="flex-1 overflow-hidden" style={{ position: 'relative' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1vw',
            height: '100%',
            gridTemplateRows: `repeat(${Math.ceil(ratedMazes.length / 3)}, 1fr)`,
          }}
        >
          {ratedMazes.map((attraction, idx) => (
            <FearCard
              key={attraction.id}
              attraction={attraction}
              rank={idx + 1}
              skullSize={skullSize}
            />
          ))}
        </div>
      </main>

      {/* Footer */}
      {!isEmbedded && (
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.1)',
            padding: '1.2vw 0',
            marginTop: '0.8vw',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'center',
            gap: '1vw',
          }}
        >
          <LightningBorder />
          <span
            style={{
              fontSize: '1vw',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              color: 'rgba(255,255,255,0.35)',
            }}
          >
            Park Closes
          </span>
          <span
            style={{
              fontSize: '2.2vw',
              fontWeight: 900,
              fontVariantNumeric: 'tabular-nums',
              color: '#fff',
            }}
          >
            {formatTime12h(closingTime)}
          </span>
        </div>
      )}
    </div>
  );
}
