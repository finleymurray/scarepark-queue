'use client';

import Link from 'next/link';

const TV_SCREENS = [
  {
    path: '/tv1',
    name: 'TV1',
    description: 'Queue times & show times list',
  },
  {
    path: '/tv2',
    name: 'TV2',
    description: 'Ride banners with scrolling ticker',
  },
  {
    path: '/tv2.5',
    name: 'TV2.5',
    description: 'Compact 4-up ride banners',
  },
  {
    path: '/tv3',
    name: 'TV3',
    description: 'Show times with artwork',
  },
  {
    path: '/tv3.5',
    name: 'TV3.5',
    description: 'Fear Rating',
  },
  {
    path: '/tv4',
    name: 'TV4',
    description: 'Auto-carousel of all TV views',
  },
  {
    path: '/tv4.5',
    name: 'TV4.5',
    description: 'Lite carousel (no iframes, Pi-friendly)',
  },
  {
    path: '/tv5',
    name: 'TV5',
    description: 'Glitch logo montage',
  },
];

const QUEUE_DISPLAYS = [
  { slug: 'the-bunker', name: 'The Bunker' },
  { slug: 'drowned', name: 'Drowned' },
  { slug: 'night-terrors', name: 'Night Terrors' },
  { slug: 'westlake-witch-trials', name: 'Westlake Witch Trials' },
  { slug: 'strings-of-control', name: 'Strings of Control' },
  { slug: 'signal-loss', name: 'Signal Loss' },
];

export default function TVHub() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center p-8">
      {/* TV Screens */}
      <h1 className="text-white text-4xl font-black mb-2 tracking-tight mt-8">TV Displays</h1>
      <p className="text-white/40 text-lg mb-10">Select a screen to launch</p>

      <div className="grid grid-cols-2 gap-6 w-full max-w-2xl">
        {TV_SCREENS.map((screen) => (
          <Link
            key={screen.path}
            href={screen.path}
            className="group block rounded-xl border-2 border-purple-500/30 bg-purple-950/30 p-8 text-center transition-all hover:border-purple-500/60 hover:bg-purple-950/50 hover:scale-[1.02]"
          >
            <h2 className="text-white text-3xl font-black mb-2 group-hover:text-purple-300 transition-colors">
              {screen.name}
            </h2>
            <p className="text-white/50 text-sm">{screen.description}</p>
          </Link>
        ))}
      </div>

      {/* Divider */}
      <div className="w-full max-w-2xl my-12 border-t border-white/10" />

      {/* Queue Entrance Displays */}
      <h2 className="text-white text-3xl font-black mb-2 tracking-tight">Queue Entrance Displays</h2>
      <p className="text-white/40 text-base mb-8">Per-attraction screens for outside each maze</p>

      <div className="grid grid-cols-3 gap-4 w-full max-w-2xl">
        {QUEUE_DISPLAYS.map((attraction) => (
          <Link
            key={attraction.slug}
            href={`/queue/${attraction.slug}`}
            className="group block rounded-xl border-2 border-amber-500/30 bg-amber-950/20 p-6 text-center transition-all hover:border-amber-500/60 hover:bg-amber-950/40 hover:scale-[1.02]"
          >
            <h3 className="text-white text-lg font-bold group-hover:text-amber-300 transition-colors">
              {attraction.name}
            </h3>
          </Link>
        ))}
      </div>
    </div>
  );
}
