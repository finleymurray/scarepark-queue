'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * ElectricHeader — Bebas Neue title with neon tube flicker + mini lightning bolts
 *
 * Features:
 *   - Bebas Neue font with purple/blue neon text-shadow
 *   - Subtle micro-flicker animation (like a faulty neon sign)
 *   - 5-7 small SVG lightning bolts crackle around the text edges
 *   - Bolts regenerate every ~2.5s with fresh random paths
 *   - Spark dots at bolt tips + micro glitch blocks
 *
 * Props:
 *   - title: string — the header text
 *   - fontSize?: string — CSS font-size (default: '2.2vw')
 */

/* ── Generate a jagged mini bolt between two points ── */
function generateMiniBolt(x1: number, y1: number, x2: number, y2: number, jitter: number): string {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const segments = Math.max(3, Math.floor(len / 5));
  const segX = dx / segments, segY = dy / segments;
  const nx = -dy / len, ny = dx / len;

  let d = `M ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  for (let i = 1; i < segments; i++) {
    const baseX = x1 + segX * i;
    const baseY = y1 + segY * i;
    const offset = (Math.random() - 0.5) * jitter * 2;
    d += ` L ${(baseX + nx * offset).toFixed(1)} ${(baseY + ny * offset).toFixed(1)}`;
  }
  d += ` L ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  return d;
}

/* ── Unique ID counter for CSS animations ── */
let idCounter = 0;

export default function ElectricHeader({
  title,
  fontSize = '2.2vw',
}: {
  title: string;
  fontSize?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const buildBolts = useCallback(() => {
    const wrap = wrapRef.current;
    const svg = svgRef.current;
    if (!wrap || !svg) return;

    const wrapRect = wrap.getBoundingClientRect();
    const textEl = wrap.querySelector('[data-electric-text]') as HTMLElement;
    if (!textEl) return;
    const textRect = textEl.getBoundingClientRect();

    const w = wrapRect.width + 80; // extra overflow space
    const h = wrapRect.height + 40;
    const offX = 40; // offset for overflow padding
    const offY = 20;

    // Text bounds relative to SVG
    const tx = textRect.left - wrapRect.left + offX;
    const ty = textRect.top - wrapRect.top + offY;
    const tw = textRect.width;
    const th = textRect.height;

    svg.setAttribute('viewBox', `0 0 ${w.toFixed(0)} ${h.toFixed(0)}`);

    // Clean up old styles
    if (styleRef.current) {
      styleRef.current.remove();
    }
    const style = document.createElement('style');
    styleRef.current = style;

    const prefix = `eh-${++idCounter}`;
    let css = '';
    let svgContent = '';

    // Generate 5-7 mini bolts
    const boltCount = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < boltCount; i++) {
      // Random point on text perimeter
      const side = Math.floor(Math.random() * 4);
      let sx: number, sy: number;
      switch (side) {
        case 0: sx = tx + Math.random() * tw; sy = ty; break;
        case 1: sx = tx + tw; sy = ty + Math.random() * th; break;
        case 2: sx = tx + Math.random() * tw; sy = ty + th; break;
        default: sx = tx; sy = ty + Math.random() * th; break;
      }

      // Shoot outward
      const angle = Math.atan2(sy - (ty + th / 2), sx - (tx + tw / 2)) + (Math.random() - 0.5) * 0.8;
      const length = 12 + Math.random() * 30;
      const ex = sx + Math.cos(angle) * length;
      const ey = sy + Math.sin(angle) * length;

      const jitter = 3 + Math.random() * 4;
      const d = generateMiniBolt(sx, sy, ex, ey, jitter);
      const delay = (Math.random() * 2.5).toFixed(2);
      const interval = (1.5 + Math.random() * 2).toFixed(2);
      const flashPct = (6 + Math.random() * 4).toFixed(1);
      const fadePct = (parseFloat(flashPct) * 2.5).toFixed(1);
      const animName = `${prefix}-b${i}`;

      css += `
        @keyframes ${animName} {
          0% { opacity: 0; }
          ${(parseFloat(flashPct) * 0.4).toFixed(1)}% { opacity: 1; }
          ${flashPct}% { opacity: 0.85; }
          ${fadePct}% { opacity: 0.1; }
          ${Math.min(100, parseFloat(fadePct) + 3).toFixed(1)}% { opacity: 0; }
          100% { opacity: 0; }
        }
      `;

      const anim = `${animName} ${interval}s ease-out ${delay}s infinite`;

      // Glow
      svgContent += `<path d="${d}" fill="none" stroke="#8B5CF6" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" opacity="0" style="filter:blur(2px);animation:${anim}" />`;
      // Core
      svgContent += `<path d="${d}" fill="none" stroke="#a78bfa" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="bevel" opacity="0" style="animation:${anim}" />`;
      // Hot center
      svgContent += `<path d="${d}" fill="none" stroke="#fff" stroke-width="0.5" stroke-linecap="round" stroke-linejoin="bevel" opacity="0" style="animation:${anim}" />`;
      // Spark at tip
      svgContent += `<circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="1.8" fill="#e0e7ff" opacity="0" style="animation:${anim}" />`;
      // Spark at origin
      svgContent += `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="1.2" fill="#e0e7ff" opacity="0" style="animation:${anim};animation-delay:${(parseFloat(delay) + 0.03).toFixed(2)}s" />`;
    }

    // 3-4 micro glitch blocks
    const blockCount = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < blockCount; i++) {
      const bx = tx + Math.random() * tw * 0.8;
      const by = ty + Math.random() * th;
      const bw = 6 + Math.random() * 20;
      const bh = 1.5 + Math.random() * 3;
      const delay = (Math.random() * 3).toFixed(2);
      const interval = (2.5 + Math.random() * 3).toFixed(2);
      const animName = `${prefix}-g${i}`;
      const shiftX = ((Math.random() - 0.5) * 5).toFixed(1);

      css += `
        @keyframes ${animName} {
          0%, 100% { opacity: 0; }
          2% { opacity: 0.4; transform: translateX(${shiftX}px); }
          4% { opacity: 0.1; }
          5% { opacity: 0; transform: translateX(0); }
        }
      `;

      svgContent += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="rgba(139,92,246,0.15)" opacity="0" style="animation:${animName} ${interval}s ease-out ${delay}s infinite" />`;
    }

    style.textContent = css;
    document.head.appendChild(style);
    svg.innerHTML = svgContent;
  }, []);

  useEffect(() => {
    // Initial build after layout settles
    const timer = setTimeout(buildBolts, 80);

    // Regenerate every 2.5s
    intervalRef.current = setInterval(buildBolts, 2500);

    return () => {
      clearTimeout(timer);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (styleRef.current) styleRef.current.remove();
    };
  }, [buildBolts]);

  // Rebuild on resize
  useEffect(() => {
    const handler = () => buildBolts();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [buildBolts]);

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative',
        textAlign: 'center',
        padding: '0.8vw 0 0.4vw',
      }}
    >
      <h1
        data-electric-text
        style={{
          fontFamily: "var(--font-bebas-neue), 'Bebas Neue', Impact, sans-serif",
          fontSize,
          textTransform: 'uppercase',
          letterSpacing: '0.35em',
          lineHeight: 1,
          margin: 0,
          color: '#e0e7ff',
          WebkitTextStroke: '0.5px rgba(139, 92, 246, 0.3)',
          textShadow: '0 0 7px rgba(139,92,246,0.9), 0 0 20px rgba(139,92,246,0.5), 0 0 40px rgba(96,165,250,0.3), 0 0 80px rgba(139,92,246,0.15)',
          animation: 'eh-neon-flicker 4s ease-in-out infinite',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {title}
      </h1>

      {/* SVG container for lightning bolts — overlaps text bounds */}
      <svg
        ref={svgRef}
        style={{
          position: 'absolute',
          top: '-20px',
          left: '-40px',
          width: 'calc(100% + 80px)',
          height: 'calc(100% + 40px)',
          zIndex: 1,
          pointerEvents: 'none',
          overflow: 'visible',
        }}
        preserveAspectRatio="none"
      />

      {/* Neon flicker keyframes */}
      <style>{`
        @keyframes eh-neon-flicker {
          0%, 100% { opacity: 1; }
          4%       { opacity: 0.85; }
          6%       { opacity: 1; }
          47%      { opacity: 1; }
          48%      { opacity: 0.7; }
          49%      { opacity: 1; }
          49.5%    { opacity: 0.9; }
          50%      { opacity: 1; }
          77%      { opacity: 1; }
          78%      { opacity: 0.75; }
          78.5%    { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
