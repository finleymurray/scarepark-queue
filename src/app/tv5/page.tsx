'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useConnectionHealth } from '@/hooks/useConnectionHealth';

/**
 * TV5 — Lightning Strike Montage with Glitch
 *
 * Skinny, sudden lightning strikes that hit the logo (which appears IN FRONT
 * of the bolts). Glitchy vibe: scanline tears, RGB channel splits, block
 * displacement on impact. Not thick tesla coils — sharp, cracking lightning.
 *
 * Sequence:
 *   1. Darkness builds (0.8s)
 *   2. Electric charge — skinny bolts crack in (0.6s)
 *   3. 6 logos revealed by striking lightning + glitch bursts (~0.5s each)
 *   4. Final discharge + white-out (0.35s)
 *   5. Repeat
 */

/* ── Attraction data ── */
const ATTRACTIONS = [
  { slug: 'westlake-witch-trials', tint: '#ff1493', tintRgb: '255,20,147', name: 'Westlake Witch Trials' },
  { slug: 'the-bunker', tint: '#dc2626', tintRgb: '220,38,38', name: 'The Bunker' },
  { slug: 'drowned', tint: '#0891b2', tintRgb: '8,145,178', name: 'Drowned' },
  { slug: 'signal-loss', tint: '#22d3ee', tintRgb: '34,211,238', name: 'Signal Loss' },
  { slug: 'strings-of-control', tint: '#eab308', tintRgb: '234,179,8', name: 'Strings of Control' },
  { slug: 'night-terrors', tint: '#e0e0e0', tintRgb: '224,224,224', name: 'Night Terrors' },
];

/* ── Timing ── */
const HOLD_BLACK = 800;
const CHARGE_UP = 600;
const LOGO_DURATION = 500;
const FLASH_OUT = 350;
const TOTAL_DURATION = HOLD_BLACK + CHARGE_UP + (ATTRACTIONS.length * LOGO_DURATION) + FLASH_OUT + 300;

/* ══════════════════════════════════════
   Skinny lightning bolt (canvas)
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
  // Outer glow — subtle, thin
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.strokeStyle = `rgba(${colorBase},0.12)`;
  ctx.lineWidth = width + glowSize;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = `rgba(${colorBase},0.5)`;
  ctx.shadowBlur = glowSize;
  ctx.stroke();

  // Bright core — the visible bolt
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.strokeStyle = `rgba(255,255,255,${coreOpacity})`;
  ctx.lineWidth = width;
  ctx.shadowColor = `rgba(${colorBase},0.9)`;
  ctx.shadowBlur = 8;
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

function drawLightningStrike(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, opts: BoltOpts = {}) {
  const {
    segments = 18, jitter = 60, width = 2.5, glowSize = 18,
    colorBase = '180,220,255', branchChance = 0.3, branchDepth = 2, opacity = 1,
  } = opts;

  ctx.save();
  ctx.globalAlpha = opacity;

  const mainPath = generateBoltPath(x1, y1, x2, y2, segments, jitter);
  drawBoltPath(ctx, mainPath, width, glowSize, colorBase, 0.95);

  // Skinny branches
  if (branchDepth > 0) {
    for (let i = 3; i < mainPath.length - 2; i++) {
      if (Math.random() < branchChance) {
        const p = mainPath[i];
        const angle = Math.atan2(y2 - y1, x2 - x1) + (Math.random() - 0.5) * Math.PI * 0.7;
        const len = (40 + Math.random() * 80) * (branchDepth / 2);
        const bx = p.x + Math.cos(angle) * len;
        const by = p.y + Math.sin(angle) * len;
        const branchPath = generateBoltPath(p.x, p.y, bx, by, 4 + Math.floor(Math.random() * 3), jitter * 0.5);
        drawBoltPath(ctx, branchPath, width * 0.6, glowSize * 0.4, colorBase, 0.5);

        // Sub-branches
        if (branchDepth > 1 && Math.random() < 0.25) {
          const sp = branchPath[Math.floor(branchPath.length * 0.6)];
          const sa = angle + (Math.random() - 0.5) * 1.2;
          const sl = 20 + Math.random() * 40;
          const subPath = generateBoltPath(sp.x, sp.y, sp.x + Math.cos(sa) * sl, sp.y + Math.sin(sa) * sl, 3, jitter * 0.3);
          drawBoltPath(ctx, subPath, width * 0.4, glowSize * 0.2, colorBase, 0.3);
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
   Glitch effects (canvas overlay)
   ══════════════════════════════════════ */

function drawGlitchFrame(ctx: CanvasRenderingContext2D, w: number, h: number, intensity: number, tintRgb: string) {
  if (intensity <= 0) { ctx.clearRect(0, 0, w, h); return; }
  ctx.clearRect(0, 0, w, h);

  // Scanline tears — horizontal slices displaced sideways
  const tearCount = Math.floor(2 + intensity * 6);
  for (let i = 0; i < tearCount; i++) {
    const y = Math.random() * h;
    const sliceH = 1 + Math.random() * 4;
    const offset = (Math.random() - 0.5) * 40 * intensity;
    ctx.fillStyle = `rgba(${tintRgb},${0.04 + Math.random() * 0.08 * intensity})`;
    ctx.fillRect(offset, y, w, sliceH);
  }

  // Block displacement — random rectangular glitch blocks
  if (intensity > 0.3) {
    const blockCount = Math.floor(1 + intensity * 3);
    for (let i = 0; i < blockCount; i++) {
      const bx = Math.random() * w;
      const by = Math.random() * h;
      const bw = 30 + Math.random() * 100;
      const bh = 2 + Math.random() * 8;
      const shift = (Math.random() - 0.5) * 20 * intensity;
      ctx.fillStyle = `rgba(${tintRgb},${0.03 + Math.random() * 0.06})`;
      ctx.fillRect(bx + shift, by, bw, bh);
    }
  }

  // Horizontal scan lines (subtle CRT feel)
  if (intensity > 0.2) {
    ctx.fillStyle = `rgba(255,255,255,${0.015 * intensity})`;
    for (let y = 0; y < h; y += 3) {
      ctx.fillRect(0, y, w, 1);
    }
  }
}

/* ══════════════════════════════════════
   Component
   ══════════════════════════════════════ */

export default function TV5Lightning() {
  useConnectionHealth('tv5');

  const boltCanvasRef = useRef<HTMLCanvasElement>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement>(null);
  const glitchCanvasRef = useRef<HTMLCanvasElement>(null);
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
    glitchIntensity: 0,
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

  // Helper: fire a glitch burst (scanlines, block displacement)
  const fireGlitchBurst = useCallback((peak: number, decayMs: number) => {
    const s = stateRef.current;
    s.glitchIntensity = peak;
    const start = performance.now();
    const decay = () => {
      const progress = Math.min((performance.now() - start) / decayMs, 1);
      s.glitchIntensity = peak * Math.pow(1 - progress, 2);
      if (progress < 1) requestAnimationFrame(decay);
      else s.glitchIntensity = 0;
    };
    requestAnimationFrame(decay);
  }, []);

  // Helper: queue a bolt
  const queueBolt = useCallback((x1: number, y1: number, x2: number, y2: number, opts: BoltOpts, lifespan = 150) => {
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

  // Helper: RGB split on the logo image
  const applyLogoGlitch = useCallback((intensity: number, tint: string) => {
    if (!logoImgRef.current) return;
    const img = logoImgRef.current;
    if (intensity > 0.3) {
      const rx = (Math.random() - 0.5) * 8 * intensity;
      const ry = (Math.random() - 0.5) * 4 * intensity;
      img.style.filter = `drop-shadow(${rx}px ${ry}px 0 rgba(255,0,0,${0.3 * intensity})) drop-shadow(${-rx}px ${-ry}px 0 rgba(0,255,255,${0.3 * intensity})) drop-shadow(0 0 40px ${tint}) drop-shadow(0 0 80px ${tint}55)`;
    }
  }, []);

  // Render loop + sequence
  useEffect(() => {
    const boltCanvas = boltCanvasRef.current;
    const staticCanvas = staticCanvasRef.current;
    const glitchCanvas = glitchCanvasRef.current;
    if (!boltCanvas || !staticCanvas || !glitchCanvas) return;
    const boltCtx = boltCanvas.getContext('2d')!;
    const staticCtx = staticCanvas.getContext('2d')!;
    const glitchCtx = glitchCanvas.getContext('2d')!;

    // Sizing
    const resize = () => {
      boltCanvas.width = window.innerWidth;
      boltCanvas.height = window.innerHeight;
      glitchCanvas.width = window.innerWidth;
      glitchCanvas.height = window.innerHeight;
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

      // Draw lingering bolts — re-jitter each frame for electric crackle
      s.activeBolts = s.activeBolts.filter((b) => {
        const age = now - b.born;
        if (age > b.lifespan) return false;
        const fadeProgress = age / b.lifespan;
        const opacity = fadeProgress < 0.3 ? 1 : 1 - ((fadeProgress - 0.3) / 0.7);
        drawLightningStrike(boltCtx, b.x1, b.y1, b.x2, b.y2, {
          ...b.opts,
          jitter: (b.opts.jitter || 60) * (0.8 + Math.random() * 0.4),
          opacity: opacity * (b.opts.opacity || 1),
        });
        return true;
      });

      // Draw static
      drawStaticFrame(staticCtx, s.staticIntensity, s.staticTint);

      // Draw glitch overlay
      drawGlitchFrame(glitchCtx, w, h, s.glitchIntensity, s.tintRgb);

      // Logo phase: occasional zap hitting logo centre
      if (s.phase === 'logo' && Math.random() < 0.04) {
        const [sx, sy] = getEdgePoint(Math.floor(Math.random() * 4), w, h);
        queueBolt(sx, sy, cx + (Math.random() - 0.5) * 40, cy + (Math.random() - 0.5) * 30, {
          segments: 22, jitter: 55, width: 2 + Math.random() * 1.5, glowSize: 14 + Math.random() * 8,
          colorBase: s.colorBase, branchChance: 0.35, branchDepth: 2,
        }, 200 + Math.random() * 150);
        fireStaticBurst(0.5 + Math.random() * 0.3, 250, s.tintRgb);
        fireGlitchBurst(0.5, 180);
        // Shake logo on impact
        if (logoContainerRef.current) {
          logoContainerRef.current.style.transform = `translate(${(Math.random() - 0.5) * 6}px, ${(Math.random() - 0.5) * 4}px)`;
          setTimeout(() => { if (logoContainerRef.current) logoContainerRef.current.style.transform = 'translate(0,0)'; }, 80);
        }
        if (edgeGlowRef.current) {
          edgeGlowRef.current.style.opacity = '0.6';
          setTimeout(() => { if (edgeGlowRef.current) edgeGlowRef.current.style.opacity = '0.15'; }, 100);
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
      s.glitchIntensity = 0;
      s.colorBase = '180,220,255';
      s.tintRgb = '100,180,255';
      if (logoContainerRef.current) logoContainerRef.current.style.opacity = '0';
      if (flashRef.current) flashRef.current.style.opacity = '0';
      if (ambientRef.current) ambientRef.current.style.opacity = '0';
      if (edgeGlowRef.current) edgeGlowRef.current.style.opacity = '0';
      if (logoGlowRef.current) logoGlowRef.current.style.opacity = '0';
      if (logoImgRef.current) logoImgRef.current.style.filter = '';

      // Phase 2: Charge — just ambient tension build, no bolts yet
      setTimeout(() => {
        if (!running) return;
        s.phase = 'charge';
        if (ambientRef.current) {
          ambientRef.current.style.background = 'radial-gradient(ellipse at center, rgba(100,180,255,0.05) 0%, transparent 60%)';
          ambientRef.current.style.opacity = '0.4';
        }
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

          // 4-6 converging strikes from all edges, spread across the screen
          const boltCount = 4 + Math.floor(Math.random() * 3);
          for (let b = 0; b < boltCount; b++) {
            // Ensure bolts come from all 4 edges (cycle through them)
            const [sx, sy] = getEdgePoint((i + b) % 4, w, h);
            // Target the logo centre with slight variance
            queueBolt(sx, sy, cx + (Math.random() - 0.5) * 30, cy + (Math.random() - 0.5) * 20, {
              segments: 24, jitter: 50 + Math.random() * 25, width: 2 + Math.random() * 1.5,
              glowSize: 16 + Math.random() * 10, colorBase: attraction.tintRgb,
              branchChance: 0.35, branchDepth: 2,
            }, 250 + Math.random() * 100);
          }

          // Burst effects
          fireStaticBurst(0.7, 350, attraction.tintRgb);
          fireGlitchBurst(0.8, 300);

          // Show logo with RGB split glitch on entry
          if (logoImgRef.current) {
            logoImgRef.current.src = `/logos/${attraction.slug}.webp`;
            logoImgRef.current.alt = attraction.name;
            // Initial RGB split that settles
            applyLogoGlitch(0.8, attraction.tint);
            setTimeout(() => {
              if (logoImgRef.current) {
                logoImgRef.current.style.filter = `drop-shadow(0 0 30px ${attraction.tint}) drop-shadow(0 0 60px rgba(${attraction.tintRgb},0.4))`;
              }
            }, 100);
          }
          if (logoContainerRef.current) {
            logoContainerRef.current.style.opacity = '1';
            // Jolt on reveal
            logoContainerRef.current.style.transform = `scale(1.04) translate(${(Math.random() - 0.5) * 5}px, ${(Math.random() - 0.5) * 3}px)`;
            setTimeout(() => { if (logoContainerRef.current) logoContainerRef.current.style.transform = 'scale(1) translate(0,0)'; }, 60);
          }
          if (logoGlowRef.current) {
            logoGlowRef.current.style.background = `radial-gradient(ellipse at center, rgba(${attraction.tintRgb},0.25) 0%, rgba(${attraction.tintRgb},0.08) 40%, transparent 65%)`;
            logoGlowRef.current.style.opacity = '1';
          }
          if (ambientRef.current) {
            ambientRef.current.style.background = `radial-gradient(ellipse at center, rgba(${attraction.tintRgb},0.08) 0%, transparent 65%)`;
            ambientRef.current.style.opacity = '0.7';
          }
          if (edgeGlowRef.current) {
            edgeGlowRef.current.style.boxShadow = `inset 0 0 80px rgba(${attraction.tintRgb},0.3), inset 0 0 200px rgba(${attraction.tintRgb},0.08)`;
            edgeGlowRef.current.style.opacity = '0.6';
            setTimeout(() => { if (edgeGlowRef.current) edgeGlowRef.current.style.opacity = '0.15'; }, 180);
          }
          if (flashRef.current) {
            flashRef.current.style.background = `rgba(${attraction.tintRgb},0.25)`;
            flashRef.current.style.opacity = '0.4';
            setTimeout(() => { if (flashRef.current) flashRef.current.style.opacity = '0'; }, 70);
          }
        }, logoStart);

        // Mid-logo follow-up strike
        setTimeout(() => {
          if (!running) return;
          const [sx, sy] = getEdgePoint(Math.floor(Math.random() * 4), w, h);
          queueBolt(sx, sy, cx + (Math.random() - 0.5) * 40, cy + (Math.random() - 0.5) * 30, {
            segments: 18, jitter: 50, width: 2 + Math.random() * 1, glowSize: 14,
            colorBase: attraction.tintRgb, branchChance: 0.3, branchDepth: 1,
          }, 200);
          fireStaticBurst(0.4, 200, attraction.tintRgb);
          fireGlitchBurst(0.4, 150);
          applyLogoGlitch(0.5, attraction.tint);
          setTimeout(() => {
            if (logoImgRef.current) {
              logoImgRef.current.style.filter = `drop-shadow(0 0 30px ${attraction.tint}) drop-shadow(0 0 60px rgba(${attraction.tintRgb},0.4))`;
            }
          }, 80);
          if (logoContainerRef.current) {
            logoContainerRef.current.style.transform = `translate(${(Math.random() - 0.5) * 4}px, ${(Math.random() - 0.5) * 3}px)`;
            setTimeout(() => { if (logoContainerRef.current) logoContainerRef.current.style.transform = 'translate(0,0)'; }, 50);
          }
        }, logoStart + LOGO_DURATION * 0.6);
      });

      // Phase 4: Final discharge
      const flashStart = t + ATTRACTIONS.length * LOGO_DURATION;
      setTimeout(() => {
        if (!running) return;
        s.phase = 'flash';

        // Multiple bolts from every direction
        for (let b = 0; b < 8; b++) {
          const [sx, sy] = getEdgePoint(b % 4, w, h);
          queueBolt(sx, sy, cx + (Math.random() - 0.5) * 60, cy + (Math.random() - 0.5) * 40, {
            segments: 24, jitter: 80, width: 2.5 + Math.random() * 1.5, glowSize: 20,
            colorBase: '220,240,255', branchChance: 0.4, branchDepth: 2,
          }, 200);
        }
        fireStaticBurst(1.0, 400, null);
        fireGlitchBurst(1.0, 350);

        if (flashRef.current) { flashRef.current.style.background = '#fff'; flashRef.current.style.opacity = '0.8'; }
        if (edgeGlowRef.current) {
          edgeGlowRef.current.style.boxShadow = 'inset 0 0 120px rgba(255,255,255,0.4), inset 0 0 250px rgba(180,220,255,0.15)';
          edgeGlowRef.current.style.opacity = '1';
        }

        setTimeout(() => { if (flashRef.current) flashRef.current.style.opacity = '0.3'; }, 70);
        setTimeout(() => { if (flashRef.current) flashRef.current.style.opacity = '0.1'; }, 140);
        setTimeout(() => {
          if (flashRef.current) flashRef.current.style.opacity = '0';
          if (edgeGlowRef.current) edgeGlowRef.current.style.opacity = '0';
          if (ambientRef.current) ambientRef.current.style.opacity = '0';
          if (logoContainerRef.current) logoContainerRef.current.style.opacity = '0';
          if (logoGlowRef.current) logoGlowRef.current.style.opacity = '0';
          s.phase = 'black';
          s.staticIntensity = 0;
          s.glitchIntensity = 0;
        }, FLASH_OUT);
      }, flashStart);

      setTimeout(runSequence, TOTAL_DURATION);
    };

    runSequence();

    return () => {
      running = false;
      window.removeEventListener('resize', resize);
    };
  }, [fireStaticBurst, fireGlitchBurst, queueBolt, getEdgePoint, applyLogoGlitch]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden', zIndex: 9999 }}>
      {/* Ambient electric glow — z1 */}
      <div ref={ambientRef} style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', opacity: 0 }} />

      {/* Static burst canvas — z2 */}
      <canvas ref={staticCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none', imageRendering: 'pixelated', mixBlendMode: 'screen' }} />

      {/* Logo glow orb — z3 */}
      <div ref={logoGlowRef} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '50%', height: '50%', borderRadius: '50%', filter: 'blur(100px)', zIndex: 3, opacity: 0, pointerEvents: 'none' }} />

      {/* Lightning bolt canvas — z4 (BELOW logo) */}
      <canvas ref={boltCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 4, pointerEvents: 'none' }} />

      {/* Logo — z5 (IN FRONT of lightning) */}
      <div ref={logoContainerRef} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, opacity: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={logoImgRef} src="" alt="" style={{ height: '45%', maxWidth: '70%', objectFit: 'contain', position: 'relative' }} />
      </div>

      {/* Glitch overlay canvas — z7 (on top for scanline tears) */}
      <canvas ref={glitchCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 7, pointerEvents: 'none', mixBlendMode: 'screen' }} />

      {/* Vignette — z11 */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.85) 100%)', zIndex: 11, pointerEvents: 'none' }} />

      {/* Edge glow — z12 */}
      <div ref={edgeGlowRef} style={{ position: 'absolute', inset: 0, zIndex: 12, pointerEvents: 'none', opacity: 0 }} />

      {/* Flash overlay — z20 */}
      <div ref={flashRef} style={{ position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none', opacity: 0 }} />
    </div>
  );
}
