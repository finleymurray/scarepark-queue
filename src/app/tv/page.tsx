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
    description: 'Ride banners with auto-paging',
  },
  {
    path: '/tv3',
    name: 'TV3',
    description: 'Show times with artwork',
  },
  {
    path: '/tv4',
    name: 'TV4',
    description: 'Auto-carousel of all TV views',
  },
];

export default function TVHub() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8">
      <h1 className="text-white text-4xl font-black mb-2 tracking-tight">TV Displays</h1>
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
    </div>
  );
}
