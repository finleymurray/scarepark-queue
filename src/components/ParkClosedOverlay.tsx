'use client';

import { useParkClosed } from '@/hooks/useParkClosed';

export default function ParkClosedOverlay() {
  const { parkClosed } = useParkClosed();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: parkClosed ? 1 : 0,
        pointerEvents: parkClosed ? 'auto' : 'none',
        transition: 'opacity 0.6s ease-in-out',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/splash.png"
        alt="Immersive Core"
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
        }}
      />
    </div>
  );
}
