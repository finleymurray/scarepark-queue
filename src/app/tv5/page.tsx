'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * TV5 — Glitch Logo Montage
 *
 * A ~3-second aggressive glitch sequence that rapid-fire cycles through
 * all 6 maze logos with themed colour tints, digital noise, RGB splitting,
 * scan-line tears, and screen flash effects. Loops continuously.
 *
 * Sequence:
 *   1. Stable black (0.5s)
 *   2. Static noise destabilises (0.3s)
 *   3. 6 logos flash in rapid succession (~0.3s each with glitch transitions)
 *   4. Final white flash + snap back to black (0.3s)
 *   5. Repeat
 */

/* ── Attraction data with themed tint colours ── */
const ATTRACTIONS = [
  { slug: 'westlake-witch-trials', tint: '#ff1493', tintRgb: '255,20,147', name: 'Westlake Witch Trials' },
  { slug: 'the-bunker', tint: '#dc2626', tintRgb: '220,38,38', name: 'The Bunker' },
  { slug: 'drowned', tint: '#0891b2', tintRgb: '8,145,178', name: 'Drowned' },
  { slug: 'signal-loss', tint: '#22d3ee', tintRgb: '34,211,238', name: 'Signal Loss' },
  { slug: 'strings-of-control', tint: '#eab308', tintRgb: '234,179,8', name: 'Strings of Control' },
  { slug: 'night-terrors', tint: '#6b21a8', tintRgb: '107,33,168', name: 'Night Terrors' },
];

const TOTAL_DURATION = 4200; // Total loop time in ms
const HOLD_BLACK = 600;      // Initial stable black
const NOISE_IN = 300;        // Static noise ramp
const LOGO_DURATION = 350;   // Each logo visible time
const FLASH_OUT = 300;       // Final flash + snap

/* ── Noise canvas generator ── */
function drawNoise(ctx: CanvasRenderingContext2D, w: number, h: number, intensity: number) {
  const imageData = ctx.createImageData(w, h);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.random() * 255 * intensity;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = Math.random() * 180 * intensity;
  }
  ctx.putImageData(imageData, 0, 0);
}

/* ── Scan line tear positions ── */
function generateTears(count: number): { y: number; shift: number; height: number }[] {
  return Array.from({ length: count }, () => ({
    y: Math.random() * 100,
    shift: (Math.random() - 0.5) * 40,
    height: 1 + Math.random() * 4,
  }));
}

export default function TV5Glitch() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<'black' | 'noise' | 'logo' | 'flash'>('black');
  const [logoIndex, setLogoIndex] = useState(-1);
  const [tears, setTears] = useState<{ y: number; shift: number; height: number }[]>([]);
  const [rgbShift, setRgbShift] = useState({ r: 0, g: 0, b: 0 });
  const [noiseIntensity, setNoiseIntensity] = useState(0);
  const [blockGlitches, setBlockGlitches] = useState<{ x: number; y: number; w: number; h: number }[]>([]);
  const animRef = useRef<number>(0);
  const loopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Preload all logos
  useEffect(() => {
    ATTRACTIONS.forEach((a) => {
      const img = new Image();
      img.src = `/logos/${a.slug}.webp`;
    });
  }, []);

  // Noise canvas animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Low res for performance
    canvas.width = 200;
    canvas.height = 120;

    let running = true;
    const draw = () => {
      if (!running) return;
      if (noiseIntensity > 0) {
        drawNoise(ctx, 200, 120, noiseIntensity);
      } else {
        ctx.clearRect(0, 0, 200, 120);
      }
      animRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [noiseIntensity]);

  // Main sequence loop
  const runSequence = useCallback(() => {
    let t = 0;

    // Phase 1: Black
    setPhase('black');
    setLogoIndex(-1);
    setNoiseIntensity(0);
    setTears([]);
    setBlockGlitches([]);
    setRgbShift({ r: 0, g: 0, b: 0 });

    // Phase 2: Noise ramp in
    setTimeout(() => {
      setPhase('noise');
      setNoiseIntensity(0.3);
      setTimeout(() => setNoiseIntensity(0.6), 100);
      setTimeout(() => setNoiseIntensity(0.9), 200);
    }, HOLD_BLACK);
    t += HOLD_BLACK;

    // Phase 3: Logo rapid fire
    t += NOISE_IN;
    ATTRACTIONS.forEach((_, i) => {
      const logoStart = t + i * LOGO_DURATION;

      setTimeout(() => {
        setPhase('logo');
        setLogoIndex(i);
        setNoiseIntensity(0.15 + Math.random() * 0.25);
        setTears(generateTears(3 + Math.floor(Math.random() * 4)));
        setRgbShift({
          r: (Math.random() - 0.5) * 20,
          g: (Math.random() - 0.5) * 20,
          b: (Math.random() - 0.5) * 20,
        });
        setBlockGlitches(
          Array.from({ length: 2 + Math.floor(Math.random() * 3) }, () => ({
            x: Math.random() * 80,
            y: Math.random() * 80,
            w: 10 + Math.random() * 30,
            h: 2 + Math.random() * 8,
          }))
        );
      }, logoStart);

      // Mid-logo glitch refresh
      setTimeout(() => {
        setTears(generateTears(2 + Math.floor(Math.random() * 3)));
        setRgbShift({
          r: (Math.random() - 0.5) * 30,
          g: (Math.random() - 0.5) * 30,
          b: (Math.random() - 0.5) * 30,
        });
      }, logoStart + LOGO_DURATION * 0.5);
    });

    // Phase 4: Flash out
    const flashStart = t + ATTRACTIONS.length * LOGO_DURATION;
    setTimeout(() => {
      setPhase('flash');
      setLogoIndex(-1);
      setNoiseIntensity(1);
      setTears([]);
      setBlockGlitches([]);
    }, flashStart);

    setTimeout(() => {
      setNoiseIntensity(0.5);
    }, flashStart + 100);

    setTimeout(() => {
      setNoiseIntensity(0);
      setPhase('black');
    }, flashStart + FLASH_OUT);

    // Loop
    loopRef.current = setTimeout(() => runSequence(), TOTAL_DURATION);
  }, []);

  useEffect(() => {
    runSequence();
    return () => {
      if (loopRef.current) clearTimeout(loopRef.current);
    };
  }, [runSequence]);

  const currentAttraction = logoIndex >= 0 ? ATTRACTIONS[logoIndex] : null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        overflow: 'hidden',
        zIndex: 9999,
      }}
    >
      {/* Noise canvas — full screen */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          imageRendering: 'pixelated',
          zIndex: 2,
          pointerEvents: 'none',
          mixBlendMode: 'screen',
        }}
      />

      {/* Colour tint overlay */}
      {currentAttraction && phase === 'logo' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at center, rgba(${currentAttraction.tintRgb},0.15) 0%, rgba(${currentAttraction.tintRgb},0.05) 50%, transparent 80%)`,
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Flash overlay */}
      {phase === 'flash' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#fff',
            zIndex: 20,
            pointerEvents: 'none',
            animation: 'tv5-flash 0.3s ease-out forwards',
          }}
        />
      )}

      {/* Logo display */}
      {currentAttraction && phase === 'logo' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 5,
          }}
        >
          {/* RGB split — red channel offset */}
          <img
            src={`/logos/${currentAttraction.slug}.webp`}
            alt=""
            style={{
              position: 'absolute',
              height: '45%',
              maxWidth: '70%',
              objectFit: 'contain',
              transform: `translate(${rgbShift.r}px, ${rgbShift.r * 0.3}px)`,
              filter: 'brightness(1.5) saturate(0) brightness(1)',
              opacity: 0.4,
              mixBlendMode: 'screen',
            }}
          />
          {/* RGB split — blue channel offset */}
          <img
            src={`/logos/${currentAttraction.slug}.webp`}
            alt=""
            style={{
              position: 'absolute',
              height: '45%',
              maxWidth: '70%',
              objectFit: 'contain',
              transform: `translate(${rgbShift.b}px, ${rgbShift.b * -0.3}px)`,
              filter: `brightness(1.5) hue-rotate(180deg)`,
              opacity: 0.3,
              mixBlendMode: 'screen',
            }}
          />
          {/* Main logo — with tint */}
          <img
            src={`/logos/${currentAttraction.slug}.webp`}
            alt={currentAttraction.name}
            style={{
              position: 'relative',
              height: '45%',
              maxWidth: '70%',
              objectFit: 'contain',
              filter: `drop-shadow(0 0 30px ${currentAttraction.tint}) drop-shadow(0 0 60px rgba(${currentAttraction.tintRgb},0.5))`,
              animation: 'tv5-logo-in 0.08s ease-out',
            }}
          />
        </div>
      )}

      {/* Scan line tears */}
      {tears.map((tear, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: `${tear.y}%`,
            height: `${tear.height}%`,
            transform: `translateX(${tear.shift}px)`,
            background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.08) 20%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.08) 80%, transparent)`,
            zIndex: 8,
            pointerEvents: 'none',
            boxShadow: `0 0 4px rgba(${currentAttraction?.tintRgb || '255,255,255'},0.3)`,
          }}
        />
      ))}

      {/* Block glitches — displaced rectangles */}
      {blockGlitches.map((block, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${block.x}%`,
            top: `${block.y}%`,
            width: `${block.w}%`,
            height: `${block.h}%`,
            background: `rgba(${currentAttraction?.tintRgb || '255,255,255'},0.06)`,
            backdropFilter: 'saturate(3) contrast(1.5)',
            zIndex: 7,
            pointerEvents: 'none',
            transform: `translateX(${(Math.random() - 0.5) * 20}px)`,
          }}
        />
      ))}

      {/* Persistent scan lines overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      />

      {/* Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.7) 100%)',
          zIndex: 11,
          pointerEvents: 'none',
        }}
      />

      {/* CSS Keyframes */}
      <style>{`
        @keyframes tv5-flash {
          0% { opacity: 1; }
          30% { opacity: 0.8; }
          60% { opacity: 0.3; }
          100% { opacity: 0; }
        }
        @keyframes tv5-logo-in {
          0% { transform: scale(1.15) translateX(10px); opacity: 0; filter: brightness(3); }
          50% { transform: scale(0.98) translateX(-3px); opacity: 1; }
          100% { transform: scale(1) translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
