'use client';

import { getAttractionLogo, getAttractionBg } from '@/lib/logos';
import type { TV4ContentProps } from './types';

function formatTime12h(time: string): string {
  if (!time) return '--:--';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${m} ${ampm}`;
}

function getNextShowTime(showTimes: string[] | null): string | null {
  if (!showTimes || showTimes.length === 0) return null;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const sorted = [...showTimes].sort();

  for (const time of sorted) {
    const [h, m] = time.split(':');
    const timeMinutes = parseInt(h, 10) * 60 + parseInt(m, 10);
    if (timeMinutes > nowMinutes) {
      return time;
    }
  }

  return null;
}

export default function TV3Content({ shows }: TV4ContentProps) {
  return (
    <main className="flex-1 flex items-center justify-center" style={{ overflow: 'hidden', minHeight: 0, height: '100%' }}>
      {shows.length === 0 ? (
        <p className="text-white/30 text-2xl">No shows configured</p>
      ) : (
        <div
          className="w-full grid items-stretch"
          style={{
            gridTemplateColumns: `repeat(${shows.length}, 1fr)`,
            gap: '0.8vw',
            height: '100%',
            maxHeight: '100%',
          }}
        >
          {shows.map((show) => {
            const nextShow = getNextShowTime(show.show_times);
            const logo = getAttractionLogo(show.slug);
            const bg = getAttractionBg(show.slug);

            return (
              <div
                key={show.id}
                className="relative flex flex-col items-center justify-center rounded-lg overflow-hidden"
                style={{ padding: '3% 4%', background: bg ? undefined : 'rgba(88, 28, 135, 0.4)', minHeight: 0 }}
              >
                {/* Background art */}
                {bg && (
                  <>
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${bg})`, opacity: 0.3, transform: 'scale(1.4)' }}
                    />
                    <div
                      className="absolute inset-0"
                      style={{ background: 'rgba(30, 10, 50, 0.6)' }}
                    />
                  </>
                )}

                {/* Logo + Show Time grouped together, centered */}
                <div className="relative z-10 flex flex-col items-center justify-center gap-[1vw]" style={{ minHeight: 0, maxHeight: '100%' }}>
                  {/* Show Name / Logo */}
                  {logo ? (
                    <img
                      src={logo}
                      alt={show.name}
                      loading="lazy"
                      decoding="async"
                      className="object-contain"
                      style={{
                        width: '95%',
                        maxWidth: 550,
                        height: 'auto',
                        maxHeight: '70%',
                        flexShrink: 1,
                        filter: 'drop-shadow(0 0 25px rgba(168, 85, 247, 0.8)) drop-shadow(0 0 50px rgba(168, 85, 247, 0.5)) drop-shadow(0 0 80px rgba(168, 85, 247, 0.3))',
                      }}
                    />
                  ) : (
                    <h2 className="text-white text-[4vw] font-black text-center leading-tight">
                      {show.name}
                    </h2>
                  )}

                  {/* "Next Show" label */}
                  <div className="text-center">
                    {show.status === 'DELAYED' ? (
                      <p className="text-[#f0ad4e] text-[3.5vw] font-bold" style={{ lineHeight: 1.2, textAlign: 'center', textTransform: 'uppercase' }}>Technical<br />Delay</p>
                    ) : nextShow ? (
                      <>
                        <p className="text-white/70 text-[1.5vw] font-semibold uppercase tracking-wider mb-[0.5vw]">
                          Next Show
                        </p>
                        <p className="text-white text-[4vw] font-black tabular-nums leading-none">
                          {formatTime12h(nextShow)}
                        </p>
                      </>
                    ) : (
                      <p className="text-white/30 text-[2.5vw] font-bold">No More Shows</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
