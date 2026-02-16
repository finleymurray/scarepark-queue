'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useConnectionHealth } from '@/hooks/useConnectionHealth';

/**
 * TV5 — Tesla Coil Lightning Montage
 *
 * A ~5-second sequence that cycles through all 6 maze logos with
 * tesla-coil-style lightning bolts, static bursts on impact, and
 * attraction-tinted electric glows. Deliberate big strikes, not frantic.
 *
 * Sequence:
 *   1. Darkness builds tension (0.8s)
 *   2. Electric charge — 2 big bolts crack in with static (0.6s)
 *   3. 6 logos revealed by massive lightning strikes (~0.5s each)
 *   4. Final discharge — bolts from every edge + white-out (0.35s)
 *   5. Repeat
 */

/* ── Attraction data ── */
const ATTRACTIONS = [
  { slug: 'westlake-witch-trials', tint: '#ff1493', tintRgb: '255,20,147', name: 'Westlake Witch Trials' },
  { slug: 'the-bunker', tint: '#dc2626', tintRgb: '220,38,38', name: 'The Bunker' },
  { slug: 'drowned', tint: '#0891b2', tintRgb: '8,145,178', name: 'Drowned' },
  { slug: 'signal-loss', tint: '#22d3ee', tintRgb: '34,211,238', name: 'Signal Loss' },
  { slug: 'strings-of-control', tint: '#eab308', tintRgb: '234,179,8', name: 'Strings of Control' },
  { slug: 'night-terrors', tint: '#6b21a8', tintRgb: '107,33,168', name: 'Night Terrors' },
];

/* ── Timing ── */
const HOLD_BLACK = 800;
const CHARGE_UP = 600;
const LOGO_DURATION = 500;
const FLASH_OUT = 350;
const TOTAL_DURATION = HOLD_BLACK + CHARGE_UP + (ATTRACTIONS.length * LOGO_DURATION) + FLASH_OUT + 300;

/* ══════════════════════════════════════
   Lightning bolt generation (canvas)
   ══════════════════════════════════════ */

interface Point { x: number; y: number }

function generateBoltPath(x1: number, y1: number, x2: number, y2: number, segments: number, jitter: number): Point[] {
  const points: Point[] = [{ x: x1, y: y1 }];
  const dx = x2 - x1;
  const dy = y2 - y1;
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const midFactor = 1 - Math.abs(t - 0.5) * 1.5;
    const j = jitter * (0.5 + midFactor);
    points.push({
      x: x1 + dx * t + (Math.random() - 0.5) * j,
      y: y1 + dy * t + (Math.random() - 0.5) * j * 0.4,
    });
  }
  points.push({ x: x2, y: y2 });
  return points;
}

function drawBoltPath(ctx: CanvasRenderingContext2D, points: Point[], width: number, glowSize: number, colorBase: string, coreOpacity: number) {
  // Outer glow
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.strokeStyle = `rgba(${colorBase},0.08)`;
  ctx.lineWidth = width + glowSize * 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = `rgba(${colorBase},0.4)`;
  ctx.shadowBlur = glowSize * 1.5;
  ctx.stroke();

  // Inner glow
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.strokeStyle = `rgba(${colorBase},0.35)`;
  ctx.lineWidth = width + glowSize * 0.5;
  ctx.shadowBlur = glowSize * 0.6;
  ctx.stroke();

  // Bright core
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.strokeStyle = `rgba(255,255,255,${coreOpacity})`;
  ctx.lineWidth = width;
  ctx.shadowColor = `rgba(${colorBase},0.9)`;
  ctx.shadowBlur = 12;
  ctx.stroke();
}

interface BoltOpts {
  segments?: number;
  jitter?: number;
  width?: number;
  glowSize?: number;
  colorBase?: string;
  branchChance?: number;
  branchDepth?: number;
  opacity?: number;
}

function drawTeslaBolt(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, opts: BoltOpts = {}) {
  const {
    segments = 16, jitter = 80, width = 3.5, glowSize = 35,
    colorBase = '180,220,255', branchChance = 0.4, branchDepth = 2, opacity = 1,
  } = opts;

  ctx.save();
  ctx.globalAlpha = opacity;

  const mainPath = generateBoltPath(x1, y1, x2, y2, segments, jitter);
  drawBoltPath(ctx, mainPath, width, glowSize, colorBase, 0.95);

  if (branchDepth > 0) {
    for (let i = 3; i < mainPath.length - 2; i++) {
      if (Math.random() < branchChance) {
        const p = mainPath[i];
        const angle = Math.atan2(y2 - y1, x2 - x1) + (Math.random() - 0.5) * Math.PI * 0.8;
        const len = (80 + Math.random() * 120) * (branchDepth / 2);
        const bx = p.x + Math.cos(angle) * len;
        const by = p.y + Math.sin(angle) * len;
        const branchPath = generateBoltPath(p.x, p.y, bx, by, 5 + Math.floor(Math.random() * 4), jitter * 0.5);
        drawBoltPath(ctx, branchPath, width * 0.5, glowSize * 0.4, colorBase, 0.6);

        if (branchDepth > 1 && Math.random() < 0.3) {
          const sp = branchPath[Math.floor(branchPath.length * 0.6)];
          const sa = angle + (Math.random() - 0.5) * 1.2;
          const sl = 40 + Math.random() * 60;
          const subPath = generateBoltPath(sp.x, sp.y, sp.x + Math.cos(sa) * sl, sp.y + Math.sin(sa) * sl, 3, jitter * 0.3);
          drawBoltPath(ctx, subPath, width * 0.3, glowSize * 0.2, colorBase, 0.35);
        }
      }
    }
  }

  ctx.restore();
}

/* ══════════════════════════════════════
   Static burst (canvas)
   ══════════════════════════════════════ */

function drawStaticFrame(ctx: CanvasRenderingContext2D, intensity: number, tint: number[] | null) {
  if (intensity <= 0) {
    ctx.clearRect(0, 0, 320, 180);
    return;
  }
  const imageData = ctx.createImageData(320, 180);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    if (Math.random() > intensity) { d[i + 3] = 0; continue; }
    const v = 100 + Math.random() * 155;
    if (tint) {
      d[i] = v * (tint[0] / 255) * 0.7 + v * 0.3;
      d[i + 1] = v * (tint[1] / 255) * 0.7 + v * 0.3;
      d[i + 2] = v * (tint[2] / 255) * 0.7 + v * 0.3;
    } else {
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    d[i + 3] = Math.floor(40 + Math.random() * 160 * intensity);
  }
  ctx.putImageData(imageData, 0, 0);
}

/* ══════════════════════════════════════
   Component
   ══════════════════════════════════════ */

export default function TV5Tesla() {
  useConnectionHealth('tv5');

  const boltCanvasRef = useRef<HTMLCanvasElement>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement>(null);
  const ambientRef = useRef<HTMLDivElement>(null);
  const logoGlowRef = useRef<HTMLDivElement>(null);
  const logoContainerRef = useRef<HTMLDivElement>(null);
  const logoImgRef = useRef<HTMLImageElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const edgeGlowRef = useRef<HTMLDivElement>(null);

  // Mutable state via refs (avoids React re-renders for 60fps animation)
  const stateRef = useRef({
    phase: 'black' as string,
    colorBase: '180,220,255',
    tintRgb: '100,180,255',
    staticIntensity: 0,
    staticTint: null as number[] | null,
    activeBolts: [] as { x1: number; y1: number; x2: number; y2: number; opts: BoltOpts; born: number; lifespan: number }[],
  });

  // Preload logos
  useEffect(() => {
    ATTRACTIONS.forEach((a) => {
      const img = new Image();
      img.src = `/logos/${a.slug}.webp`;
    });
  }, []);

  // Helper: fire a decaying static burst
  const fireStaticBurst = useCallback((peak: number, decayMs: number, tintRgb: string | null) => {
    const s = stateRef.current;
    s.staticIntensity = peak;
    s.staticTint = tintRgb ? tintRgb.split(',').map(Number) : null;
    const start = performance.now();
    const decay = () => {
      const progress = Math.min((performance.now() - start) / decayMs, 1);
      s.staticIntensity = peak * Math.pow(1 - progress, 2);
      if (progress < 1) requestAnimationFrame(decay);
      else s.staticIntensity = 0;
    };
    requestAnimationFrame(decay);
  }, []);

  // Helper: queue a bolt
  const queueBolt = useCallback((x1: number, y1: number, x2: number, y2: number, opts: BoltOpts, lifespan = 200) => {
    stateRef.current.activeBolts.push({ x1, y1, x2, y2, opts, born: performance.now(), lifespan });
  }, []);

  // Helper: get edge start point
  const getEdgePoint = useCallback((side: number, w: number, h: number): [number, number] => {
    switch (side % 4) {
      case 0: return [Math.random() * w, -30];
      case 1: return [w + 30, Math.random() * h];
      case 2: return [Math.random() * w, h + 30];
      default: return [-30, Math.random() * h];
    }
  }, []);

  // Render loop + sequence
  useEffect(() => {
    const boltCanvas = boltCanvasRef.current;
    const staticCanvas = staticCanvasRef.current;
    if (!boltCanvas || !staticCanvas) return;
    const boltCtx = boltCanvas.getContext('2d')!;
    const staticCtx = staticCanvas.getContext('2d')!;

    // Sizing
    const resize = () => {
      boltCanvas.width = window.innerWidth;
      boltCanvas.height = window.innerHeight;
      staticCanvas.width = 320;
      staticCanvas.height = 180;
    };
    resize();
    window.addEventListener('resize', resize);

    let running = true;
    const s = stateRef.current;

    // ── Render loop ──
    const renderFrame = () => {
      if (!running) return;
      const now = performance.now();
      const w = boltCanvas.width;
      const h = boltCanvas.height;
      const cx = w / 2;
      const cy = h / 2;

      boltCtx.clearRect(0, 0, w, h);

      // Draw lingering bolts
      s.activeBolts = s.activeBolts.filter((b) => {
        const age = now - b.born;
        if (age > b.lifespan) return false;
        const fadeProgress = age / b.lifespan;
        const opacity = fadeProgress < 0.4 ? 1 : 1 - ((fadeProgress - 0.4) / 0.6);
        const jitterMult = 0.7 + Math.random() * 0.6;
        drawTeslaBolt(boltCtx, b.x1, b.y1, b.x2, b.y2, {
          ...b.opts,
          jitter: (b.opts.jitter || 80) * jitterMult,
          opacity: opacity * (b.opts.opacity || 1),
        });
        return true;
      });

      // Draw static
      drawStaticFrame(staticCtx, s.staticIntensity, s.staticTint);

      // Charge phase: occasional big bolt
      if (s.phase === 'charge' && Math.random() < 0.06) {
        const [sx, sy] = getEdgePoint(Math.floor(Math.random() * 4), w, h);
        queueBolt(sx, sy, cx + (Math.random() - 0.5) * w * 0.2, cy + (Math.random() - 0.5) * h * 0.2, {
          segments: 18, jitter: 100, width: 3 + Math.random() * 2, glowSize: 40,
          colorBase: s.colorBase, branchChance: 0.45, branchDepth: 2,
        }, 300 + Math.random() * 200);
        fireStaticBurst(0.5 + Math.random() * 0.3, 250, s.tintRgb);
        if (edgeGlowRef.current) {
          edgeGlowRef.current.style.boxShadow = `inset 0 0 100px rgba(${s.tintRgb},0.25), inset 0 0 250px rgba(${s.tintRgb},0.08)`;
          edgeGlowRef.current.style.opacity = '0.6';
          setTimeout(() => { if (edgeGlowRef.current) edgeGlowRef.current.style.opacity = '0.1'; }, 150);
        }
      }

      // Logo phase: occasional tesla zap
      if (s.phase === 'logo' && Math.random() < 0.04) {
        const [sx, sy] = getEdgePoint(Math.floor(Math.random() * 4), w, h);
        queueBolt(sx, sy, cx + (Math.random() - 0.5) * w * 0.1, cy + (Math.random() - 0.5) * h * 0.1, {
          segments: 20, jitter: 90, width: 4 + Math.random() * 2, glowSize: 45,
          colorBase: s.colorBase, branchChance: 0.5, branchDepth: 2,
        }, 350 + Math.random() * 200);
        fireStaticBurst(0.7 + Math.random() * 0.3, 350, s.tintRgb);
        if (logoContainerRef.current) {
          logoContainerRef.current.style.transform = `translate(${(Math.random() - 0.5) * 6}px, ${(Math.random() - 0.5) * 4}px)`;
          setTimeout(() => { if (logoContainerRef.current) logoContainerRef.current.style.transform = 'translate(0,0)'; }, 80);
        }
        if (edgeGlowRef.current) {
          edgeGlowRef.current.style.opacity = '0.7';
          setTimeout(() => { if (edgeGlowRef.current) edgeGlowRef.current.style.opacity = '0.15'; }, 120);
        }
      }

      requestAnimationFrame(renderFrame);
    };
    requestAnimationFrame(renderFrame);

    // ── Main sequence ──
    const runSequence = () => {
      if (!running) return;
      let t = 0;
      const w = boltCanvas.width;
      const h = boltCanvas.height;
      const cx = w / 2;
      const cy = h / 2;

      // Reset
      s.phase = 'black';
      s.activeBolts = [];
      s.staticIntensity = 0;
      s.colorBase = '180,220,255';
      s.tintRgb = '100,180,255';
      if (logoContainerRef.current) logoContainerRef.current.style.opacity = '0';
      if (flashRef.current) flashRef.current.style.opacity = '0';
      if (ambientRef.current) ambientRef.current.style.opacity = '0';
      if (edgeGlowRef.current) edgeGlowRef.current.style.opacity = '0';
      if (logoGlowRef.current) logoGlowRef.current.style.opacity = '0';

      // Phase 2: Charge
      setTimeout(() => {
        if (!running) return;
        s.phase = 'charge';
        if (ambientRef.current) {
          ambientRef.current.style.background = 'radial-gradient(ellipse at center, rgba(100,180,255,0.06) 0%, transparent 60%)';
          ambientRef.current.style.opacity = '0.4';
        }
        // First big bolt
        setTimeout(() => {
          if (!running) return;
          const sx = w * 0.3 + Math.random() * w * 0.4;
          queueBolt(sx, -30, cx + (Math.random() - 0.5) * 100, cy + (Math.random() - 0.5) * 80, {
            segments: 20, jitter: 100, width: 4, glowSize: 50,
            colorBase: '180,220,255', branchChance: 0.5, branchDepth: 2,
          }, 400);
          fireStaticBurst(0.8, 400, '180,220,255');
          if (edgeGlowRef.current) {
            edgeGlowRef.current.style.boxShadow = 'inset 0 0 100px rgba(100,180,255,0.3), inset 0 0 250px rgba(100,180,255,0.1)';
            edgeGlowRef.current.style.opacity = '0.6';
            setTimeout(() => { if (edgeGlowRef.current) edgeGlowRef.current.style.opacity = '0.15'; }, 200);
          }
        }, 100);
        // Second bolt from side
        setTimeout(() => {
          if (!running) return;
          queueBolt(-30, h * 0.3 + Math.random() * h * 0.4, cx + (Math.random() - 0.5) * 80, cy + (Math.random() - 0.5) * 60, {
            segments: 18, jitter: 90, width: 3.5, glowSize: 40,
            colorBase: '180,220,255', branchChance: 0.45, branchDepth: 2,
          }, 350);
          fireStaticBurst(0.6, 300, '180,220,255');
        }, 350);
      }, HOLD_BLACK);
      t = HOLD_BLACK;

      // Phase 3: Logo reveals
      t += CHARGE_UP;
      ATTRACTIONS.forEach((attraction, i) => {
        const logoStart = t + i * LOGO_DURATION;

        setTimeout(() => {
          if (!running) return;
          s.phase = 'logo';
          s.colorBase = attraction.tintRgb;
          s.tintRgb = attraction.tintRgb;

          // 2-3 converging bolts
          const boltCount = 2 + Math.floor(Math.random() * 2);
          for (let b = 0; b < boltCount; b++) {
            const [sx, sy] = getEdgePoint((i + b) % 4, w, h);
            queueBolt(sx, sy, cx + (Math.random() - 0.5) * 60, cy + (Math.random() - 0.5) * 40, {
              segments: 22, jitter: 80 + Math.random() * 40, width: 4 + Math.random() * 2,
              glowSize: 45 + Math.random() * 15, colorBase: attraction.tintRgb,
              branchChance: 0.5, branchDepth: 2,
            }, 400 + Math.random() * 150);
          }

          fireStaticBurst(0.9, 400, attraction.tintRgb);

          // Show logo
          if (logoImgRef.current) {
            logoImgRef.current.src = `/logos/${attraction.slug}.webp`;
            logoImgRef.current.alt = attraction.name;
            logoImgRef.current.style.filter = `drop-shadow(0 0 40px ${attraction.tint}) drop-shadow(0 0 80px rgba(${attraction.tintRgb},0.5))`;
          }
          if (logoContainerRef.current) {
            logoContainerRef.current.style.opacity = '1';
            logoContainerRef.current.style.transform = `scale(1.06) translate(${(Math.random() - 0.5) * 6}px, ${(Math.random() - 0.5) * 3}px)`;
            setTimeout(() => { if (logoContainerRef.current) logoContainerRef.current.style.transform = 'scale(1) translate(0,0)'; }, 70);
          }
          if (logoGlowRef.current) {
            logoGlowRef.current.style.background = `radial-gradient(ellipse at center, rgba(${attraction.tintRgb},0.3) 0%, rgba(${attraction.tintRgb},0.1) 40%, transparent 65%)`;
            logoGlowRef.current.style.opacity = '1';
          }
          if (ambientRef.current) {
            ambientRef.current.style.background = `radial-gradient(ellipse at center, rgba(${attraction.tintRgb},0.1) 0%, transparent 65%)`;
            ambientRef.current.style.opacity = '0.8';
          }
          if (edgeGlowRef.current) {
            edgeGlowRef.current.style.boxShadow = `inset 0 0 100px rgba(${attraction.tintRgb},0.35), inset 0 0 250px rgba(${attraction.tintRgb},0.1)`;
            edgeGlowRef.current.style.opacity = '0.7';
            setTimeout(() => { if (edgeGlowRef.current) edgeGlowRef.current.style.opacity = '0.2'; }, 200);
          }
          if (flashRef.current) {
            flashRef.current.style.background = `rgba(${attraction.tintRgb},0.3)`;
            flashRef.current.style.opacity = '0.5';
            setTimeout(() => { if (flashRef.current) flashRef.current.style.opacity = '0'; }, 80);
          }
        }, logoStart);

        // Mid-logo zap
        setTimeout(() => {
          if (!running) return;
          const [sx, sy] = getEdgePoint(Math.floor(Math.random() * 4), w, h);
          queueBolt(sx, sy, cx + (Math.random() - 0.5) * 80, cy + (Math.random() - 0.5) * 60, {
            segments: 16, jitter: 70, width: 3, glowSize: 35,
            colorBase: attraction.tintRgb, branchChance: 0.4, branchDepth: 1,
          }, 300);
          fireStaticBurst(0.5, 250, attraction.tintRgb);
          if (logoContainerRef.current) {
            logoContainerRef.current.style.transform = `translate(${(Math.random() - 0.5) * 4}px, ${(Math.random() - 0.5) * 3}px)`;
            setTimeout(() => { if (logoContainerRef.current) logoContainerRef.current.style.transform = 'translate(0,0)'; }, 60);
          }
        }, logoStart + LOGO_DURATION * 0.6);
      });

      // Phase 4: Final discharge
      const flashStart = t + ATTRACTIONS.length * LOGO_DURATION;
      setTimeout(() => {
        if (!running) return;
        s.phase = 'flash';

        for (let b = 0; b < 5; b++) {
          const [sx, sy] = getEdgePoint(b % 4, w, h);
          queueBolt(sx, sy, cx + (Math.random() - 0.5) * 100, cy + (Math.random() - 0.5) * 80, {
            segments: 22, jitter: 120, width: 5, glowSize: 60,
            colorBase: '220,240,255', branchChance: 0.6, branchDepth: 2,
          }, 300);
        }
        fireStaticBurst(1.0, 500, null);

        if (flashRef.current) { flashRef.current.style.background = '#fff'; flashRef.current.style.opacity = '0.9'; }
        if (edgeGlowRef.current) {
          edgeGlowRef.current.style.boxShadow = 'inset 0 0 150px rgba(255,255,255,0.5), inset 0 0 300px rgba(180,220,255,0.2)';
          edgeGlowRef.current.style.opacity = '1';
        }

        setTimeout(() => { if (flashRef.current) flashRef.current.style.opacity = '0.4'; }, 80);
        setTimeout(() => { if (flashRef.current) flashRef.current.style.opacity = '0.15'; }, 160);
        setTimeout(() => {
          if (flashRef.current) flashRef.current.style.opacity = '0';
          if (edgeGlowRef.current) edgeGlowRef.current.style.opacity = '0';
          if (ambientRef.current) ambientRef.current.style.opacity = '0';
          if (logoContainerRef.current) logoContainerRef.current.style.opacity = '0';
          if (logoGlowRef.current) logoGlowRef.current.style.opacity = '0';
          s.phase = 'black';
          s.staticIntensity = 0;
        }, FLASH_OUT);
      }, flashStart);

      setTimeout(runSequence, TOTAL_DURATION);
    };

    runSequence();

    return () => {
      running = false;
      window.removeEventListener('resize', resize);
    };
  }, [fireStaticBurst, queueBolt, getEdgePoint]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden', zIndex: 9999 }}>
      {/* Lightning bolt canvas */}
      <canvas ref={boltCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 6, pointerEvents: 'none' }} />

      {/* Static burst canvas */}
      <canvas ref={staticCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none', imageRendering: 'pixelated', mixBlendMode: 'screen' }} />

      {/* Ambient electric glow */}
      <div ref={ambientRef} style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', opacity: 0 }} />

      {/* Logo glow orb */}
      <div ref={logoGlowRef} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '50%', height: '50%', borderRadius: '50%', filter: 'blur(100px)', zIndex: 3, opacity: 0, pointerEvents: 'none' }} />

      {/* Logo */}
      <div ref={logoContainerRef} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, opacity: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={logoImgRef} src="" alt="" style={{ height: '45%', maxWidth: '70%', objectFit: 'contain', position: 'relative' }} />
      </div>

      {/* Flash overlay */}
      <div ref={flashRef} style={{ position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none', opacity: 0 }} />

      {/* Edge glow */}
      <div ref={edgeGlowRef} style={{ position: 'absolute', inset: 0, zIndex: 12, pointerEvents: 'none', opacity: 0 }} />

      {/* Vignette */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.85) 100%)', zIndex: 11, pointerEvents: 'none' }} />
    </div>
  );
}
