'use client';

import { useEffect, useState, useRef } from 'react';

/**
 * TV4 — Carousel that cycles through all TV views via iframes.
 *
 * Sequence:
 *   /tv   (queue + show times list)  — 30s
 *   /tv2  (ride banners, paginated)  — 30s  (tv2 handles its own 10s page cycling)
 *   /tv3  (show times grid)          — 30s
 *
 * Each iframe stays mounted so realtime subscriptions stay alive.
 * Only the active iframe is visible; transitions use a fade effect.
 */

const VIEWS = [
  { path: '/tv', duration: 30000 },
  { path: '/tv2', duration: 30000 },
  { path: '/tv3', duration: 30000 },
];

const FADE_MS = 600;

export default function TV4Carousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function scheduleNext() {
      const current = VIEWS[activeIndex];
      timerRef.current = setTimeout(() => {
        setFading(true);
        setTimeout(() => {
          setActiveIndex((prev) => (prev + 1) % VIEWS.length);
          setFading(false);
          // scheduleNext is called via the activeIndex effect below
        }, FADE_MS);
      }, current.duration);
    }

    scheduleNext();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeIndex]);

  return (
    <div className="h-screen w-screen bg-black relative overflow-hidden">
      {VIEWS.map((view, i) => (
        <iframe
          key={view.path}
          src={view.path}
          title={`TV View ${view.path}`}
          className="absolute inset-0 w-full h-full border-0 transition-opacity"
          style={{
            opacity: i === activeIndex && !fading ? 1 : 0,
            pointerEvents: i === activeIndex ? 'auto' : 'none',
            transitionDuration: `${FADE_MS}ms`,
          }}
        />
      ))}

      {/* View indicator dots */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-50"
        style={{ pointerEvents: 'none' }}
      >
        {VIEWS.map((view, i) => (
          <div
            key={view.path}
            className="rounded-full transition-colors duration-300"
            style={{
              width: 8,
              height: 8,
              backgroundColor: i === activeIndex ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.25)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
