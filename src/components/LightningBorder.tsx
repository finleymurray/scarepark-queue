'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';

/* ── Bolt path generators ── */

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

/**
 * Animated Tesla coil / lightning bolt border.
 *
 * Two modes:
 * 1. IDLE BUZZ — active, jittery, buzzing line with micro-branches and sparks.
 *    Regenerates frequently for a restless electric hum.
 * 2. CRACK — every 5–10s a violent bolt shoots across with branches & sparks,
 *    then fades back to idle over ~500ms.
 */
export default function LightningBorder() {
  const [mode, setMode] = useState<'idle' | 'crack'>('idle');
  const [boltKey, setBoltKey] = useState(0);
  const crackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextCrackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Schedule the next crack
  const scheduleCrack = useCallback(() => {
    const delay = 5000 + Math.random() * 5000; // 5–10s
    nextCrackRef.current = setTimeout(() => {
      setBoltKey((k) => k + 1);
      setMode('crack');
      // Return to idle after the crack flash
      crackTimeoutRef.current = setTimeout(() => {
        setMode('idle');
        scheduleCrack();
      }, 500);
    }, delay);
  }, []);

  useEffect(() => {
    scheduleCrack();
    return () => {
      if (nextCrackRef.current) clearTimeout(nextCrackRef.current);
      if (crackTimeoutRef.current) clearTimeout(crackTimeoutRef.current);
    };
  }, [scheduleCrack]);

  // Buzzy idle bolt — regenerate frequently for jittery feel
  const [idleKey, setIdleKey] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setIdleKey((k) => k + 1), 1800);
    return () => clearInterval(interval);
  }, []);

  // Idle SVG data — two buzzy bolts with micro-branches and sparks
  const idleSvg = useMemo(() => {
    const w = 1000;
    const cy = 5;
    const bolt1 = generateBolt(w, cy, 80, 2.2);
    const bolt2 = generateBolt(w, cy, 60, 1.8);

    // Micro-branches — small forks that flicker
    const branches: { d: string; cls: string }[] = [];
    for (let i = 0; i < 4; i++) {
      const bx = 100 + Math.random() * 800;
      const by = cy + (Math.random() - 0.5) * 2;
      const angle = (Math.random() > 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6);
      const len = 4 + Math.random() * 8;
      branches.push({ d: generateBranch(bx, by, len, angle), cls: `b${(i % 4) + 1}` });
    }

    // Small sparks
    const sparks: { cx: number; cy: number }[] = [];
    for (let i = 0; i < 3; i++) {
      sparks.push({ cx: 100 + Math.random() * 800, cy: cy + (Math.random() - 0.5) * 2 });
    }

    return { bolt1, bolt2, branches, sparks };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idleKey]);

  // Crack SVG data — aggressive jitter, multiple bolts, branches, sparks
  const crackSvg = useMemo(() => {
    const w = 1000;
    const cy = 5;
    const bolt1 = generateBolt(w, cy, 80, 4);
    const bolt2 = generateBolt(w, cy, 65, 3);
    const bolt3 = generateBolt(w, cy, 50, 3.5);

    const branches: { d: string; cls: string }[] = [];
    for (let i = 0; i < 8; i++) {
      const bx = 50 + Math.random() * 900;
      const by = cy + (Math.random() - 0.5) * 3;
      const angle = (Math.random() > 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.8);
      const len = 8 + Math.random() * 16;
      branches.push({ d: generateBranch(bx, by, len, angle), cls: `b${(i % 6) + 1}` });
    }

    const sparks: { cx: number; cy: number }[] = [];
    for (let i = 0; i < 7; i++) {
      sparks.push({ cx: 60 + Math.random() * 880, cy: cy + (Math.random() - 0.5) * 3 });
    }

    return { bolt1, bolt2, bolt3, branches, sparks };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boltKey]);

  const isCrack = mode === 'crack';

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
      {/* ── IDLE BUZZ ── active, jittery electric hum */}
      <svg
        viewBox="0 0 1000 10"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
          opacity: isCrack ? 0 : 1,
          transition: 'opacity 0.3s ease-out',
        }}
      >
        <style>{`
          .lb-idle-amb { fill:none; stroke:#7c3aed; stroke-width:8; stroke-linecap:round; opacity:0.12; filter:url(#lb-blur5); animation:lb-idle-amb 1.5s ease-in-out infinite; }
          .lb-idle-glow { fill:none; stroke-width:3.5; stroke-linecap:round; filter:url(#lb-blur2); animation:lb-idle-glow 1.5s ease-in-out infinite; }
          .lb-idle-core { fill:none; stroke-width:1.1; stroke-linecap:round; stroke-linejoin:bevel; animation:lb-idle-core 1.5s ease-in-out infinite; }
          .lb-idle-hot { fill:none; stroke-width:0.4; stroke:#fff; stroke-linecap:round; animation:lb-idle-hot 0.8s ease-in-out infinite; }
          .lb-idle-s2 .lb-idle-core,.lb-idle-s2 .lb-idle-glow,.lb-idle-s2 .lb-idle-amb { animation-delay:0.4s; }
          .lb-idle-br { fill:none; stroke-width:0.6; stroke-linecap:round; stroke-linejoin:bevel; opacity:0; animation:lb-idle-bf 1.8s ease-in-out infinite; }
          .lb-idle-brg { fill:none; stroke-width:2; stroke-linecap:round; filter:url(#lb-blur1); opacity:0; animation:lb-idle-bfg 1.8s ease-in-out infinite; }
          .lb-idle-b1 { animation-delay:0s; } .lb-idle-b2 { animation-delay:0.5s; } .lb-idle-b3 { animation-delay:1.1s; } .lb-idle-b4 { animation-delay:0.3s; }
          @keyframes lb-idle-core { 0%{stroke:#8B5CF6;opacity:0.7}15%{stroke:#c4b5fd;opacity:0.85}30%{stroke:#818cf8;opacity:0.7}50%{stroke:#a78bfa;opacity:0.8}70%{stroke:#c084fc;opacity:0.75}85%{stroke:#e0e7ff;opacity:0.9}100%{stroke:#8B5CF6;opacity:0.7} }
          @keyframes lb-idle-glow { 0%{stroke:#7c3aed;opacity:0.25}20%{stroke:#8B5CF6;opacity:0.4}40%{stroke:#818cf8;opacity:0.3}60%{stroke:#a78bfa;opacity:0.38}80%{stroke:#c084fc;opacity:0.32}100%{stroke:#7c3aed;opacity:0.25} }
          @keyframes lb-idle-amb { 0%{stroke:#7c3aed;opacity:0.1}30%{stroke:#8B5CF6;opacity:0.18}60%{stroke:#818cf8;opacity:0.14}100%{stroke:#7c3aed;opacity:0.1} }
          @keyframes lb-idle-hot { 0%,100%{opacity:0.35}20%{opacity:0.7}40%{opacity:0.3}60%{opacity:0.65}80%{opacity:0.4} }
          @keyframes lb-idle-bf { 0%,100%{opacity:0;stroke:#8B5CF6}5%{opacity:0.8;stroke:#e0e7ff}10%{opacity:0.1;stroke:#a78bfa}15%{opacity:0.6;stroke:#c4b5fd}22%{opacity:0;stroke:#8B5CF6} }
          @keyframes lb-idle-bfg { 0%,100%{opacity:0;stroke:#7c3aed}5%{opacity:0.4;stroke:#c4b5fd}10%{opacity:0.05;stroke:#8B5CF6}15%{opacity:0.3;stroke:#a78bfa}22%{opacity:0;stroke:#7c3aed} }
        `}</style>
        <defs>
          <filter id="lb-blur1"><feGaussianBlur stdDeviation="1.5" /></filter>
          <filter id="lb-blur2"><feGaussianBlur stdDeviation="2" /></filter>
          <filter id="lb-blur5"><feGaussianBlur stdDeviation="5" /></filter>
        </defs>
        {/* Two buzzy bolts */}
        <path className="lb-idle-amb" d={idleSvg.bolt1} />
        <g className="lb-idle-s2"><path className="lb-idle-amb" d={idleSvg.bolt2} /></g>
        <path className="lb-idle-glow" d={idleSvg.bolt1} />
        <g className="lb-idle-s2"><path className="lb-idle-glow" d={idleSvg.bolt2} /></g>
        <path className="lb-idle-core" d={idleSvg.bolt1} />
        <g className="lb-idle-s2"><path className="lb-idle-core" d={idleSvg.bolt2} /></g>
        <path className="lb-idle-hot" d={idleSvg.bolt1} />
        {/* Micro-branches */}
        {idleSvg.branches.map((b, i) => (
          <React.Fragment key={i}>
            <path className={`lb-idle-brg lb-idle-${b.cls}`} d={b.d} />
            <path className={`lb-idle-br lb-idle-${b.cls}`} d={b.d} />
          </React.Fragment>
        ))}
        {/* Sparks */}
        {idleSvg.sparks.map((s, i) => (
          <circle key={i} fill="#fff" cx={s.cx} cy={s.cy} r={0.8} opacity={0}>
            <animate attributeName="opacity" values="0;0.8;0.2;0.7;0" dur={`${(1 + Math.random() * 1).toFixed(1)}s`} repeatCount="indefinite" begin={`${(Math.random() * 1.5).toFixed(1)}s`} />
            <animate attributeName="r" values="0.4;1.5;0.6;1.2;0.4" dur={`${(1 + Math.random() * 1).toFixed(1)}s`} repeatCount="indefinite" begin={`${(Math.random() * 1.5).toFixed(1)}s`} />
          </circle>
        ))}
      </svg>

      {/* ── CRACK ── violent burst that appears on top */}
      <svg
        viewBox="0 0 1000 10"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
          opacity: isCrack ? 1 : 0,
          transition: isCrack ? 'opacity 0.02s linear' : 'opacity 0.4s ease-out',
        }}
      >
        <style>{`
          .lb-cr-core { fill:none; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:bevel; animation:lb-cr-flash 0.5s ease-out forwards; }
          .lb-cr-glow { fill:none; stroke-width:5; stroke-linecap:round; stroke-linejoin:round; filter:url(#lb-cblur2); animation:lb-cr-gflash 0.5s ease-out forwards; }
          .lb-cr-amb  { fill:none; stroke-width:14; stroke-linecap:round; stroke-linejoin:round; filter:url(#lb-cblur5); animation:lb-cr-aflash 0.5s ease-out forwards; }
          .lb-cr-hot  { fill:none; stroke-width:0.8; stroke:#fff; stroke-linecap:round; stroke-linejoin:bevel; animation:lb-cr-hflash 0.5s ease-out forwards; }
          .lb-cr-s2 .lb-cr-core,.lb-cr-s2 .lb-cr-glow,.lb-cr-s2 .lb-cr-amb,.lb-cr-s2 .lb-cr-hot { animation-delay:0.03s; }
          .lb-cr-s3 .lb-cr-core,.lb-cr-s3 .lb-cr-glow,.lb-cr-s3 .lb-cr-amb,.lb-cr-s3 .lb-cr-hot { animation-delay:0.06s; }
          .lb-cr-br   { fill:none; stroke-width:1; stroke-linecap:round; stroke-linejoin:bevel; animation:lb-cr-bflash 0.4s ease-out forwards; }
          .lb-cr-brg  { fill:none; stroke-width:3; stroke-linecap:round; stroke-linejoin:round; filter:url(#lb-cblur1); animation:lb-cr-bgflash 0.4s ease-out forwards; }
          .lb-cr-b1 { animation-delay:0s; } .lb-cr-b2 { animation-delay:0.02s; } .lb-cr-b3 { animation-delay:0.05s; }
          .lb-cr-b4 { animation-delay:0.01s; } .lb-cr-b5 { animation-delay:0.04s; } .lb-cr-b6 { animation-delay:0.03s; }
          @keyframes lb-cr-flash { 0%{stroke:#fff;opacity:1}8%{stroke:#e0e7ff;opacity:1}15%{stroke:#fff;opacity:0.9}30%{stroke:#c4b5fd;opacity:1}50%{stroke:#a78bfa;opacity:0.85}70%{stroke:#8B5CF6;opacity:0.6}100%{stroke:#7c3aed;opacity:0.3} }
          @keyframes lb-cr-gflash { 0%{stroke:#e0e7ff;opacity:0.9}8%{stroke:#fff;opacity:0.8}20%{stroke:#c4b5fd;opacity:0.7}50%{stroke:#a78bfa;opacity:0.5}100%{stroke:#7c3aed;opacity:0.15} }
          @keyframes lb-cr-aflash { 0%{stroke:#c4b5fd;opacity:0.5}15%{stroke:#e0e7ff;opacity:0.45}40%{stroke:#8B5CF6;opacity:0.3}100%{stroke:#7c3aed;opacity:0.05} }
          @keyframes lb-cr-hflash { 0%{opacity:1}15%{opacity:0.9}40%{opacity:0.6}100%{opacity:0} }
          @keyframes lb-cr-bflash { 0%{stroke:#fff;opacity:1}10%{stroke:#e0e7ff;opacity:0.9}30%{stroke:#c4b5fd;opacity:0.7}60%{stroke:#8B5CF6;opacity:0.3}100%{stroke:#7c3aed;opacity:0} }
          @keyframes lb-cr-bgflash { 0%{stroke:#c4b5fd;opacity:0.7}15%{stroke:#e0e7ff;opacity:0.5}40%{stroke:#8B5CF6;opacity:0.3}100%{stroke:#7c3aed;opacity:0} }
        `}</style>
        <defs>
          <filter id="lb-cblur1"><feGaussianBlur stdDeviation="1.5" /></filter>
          <filter id="lb-cblur2"><feGaussianBlur stdDeviation="2.5" /></filter>
          <filter id="lb-cblur5"><feGaussianBlur stdDeviation="6" /></filter>
        </defs>
        {/* Ambient glow */}
        <path className="lb-cr-amb" d={crackSvg.bolt1} />
        <g className="lb-cr-s2"><path className="lb-cr-amb" d={crackSvg.bolt2} /></g>
        {/* Glow layer */}
        <path className="lb-cr-glow" d={crackSvg.bolt1} />
        <g className="lb-cr-s2"><path className="lb-cr-glow" d={crackSvg.bolt2} /></g>
        <g className="lb-cr-s3"><path className="lb-cr-glow" d={crackSvg.bolt3} /></g>
        {/* Core bolts */}
        <path className="lb-cr-core" d={crackSvg.bolt1} />
        <g className="lb-cr-s2"><path className="lb-cr-core" d={crackSvg.bolt2} /></g>
        <g className="lb-cr-s3"><path className="lb-cr-core" d={crackSvg.bolt3} /></g>
        {/* Hot white center */}
        <path className="lb-cr-hot" d={crackSvg.bolt1} />
        {/* Branches */}
        {crackSvg.branches.map((b, i) => (
          <React.Fragment key={i}>
            <path className={`lb-cr-brg lb-cr-${b.cls}`} d={b.d} />
            <path className={`lb-cr-br lb-cr-${b.cls}`} d={b.d} />
          </React.Fragment>
        ))}
        {/* Sparks — bright nodes that flash and fade */}
        {crackSvg.sparks.map((s, i) => (
          <circle key={i} fill="#fff" cx={s.cx} cy={s.cy} r={0.5} opacity={0}>
            <animate
              attributeName="opacity"
              values="0;1;0.8;0.4;0"
              dur="0.5s"
              begin="0s"
              fill="freeze"
            />
            <animate
              attributeName="r"
              values="0.5;3;1.5;2;0.5"
              dur="0.5s"
              begin="0s"
              fill="freeze"
            />
          </circle>
        ))}
      </svg>
    </div>
  );
}
