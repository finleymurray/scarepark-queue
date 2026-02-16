'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getAttractionLogo, getQueueBg, getLogoGlow } from '@/lib/logos';
import LightningBorder from '@/components/LightningBorder';
import ElectricHeader from '@/components/ElectricHeader';
import type { Attraction } from '@/types/database';

export default function QueueDisplayClient({ slug }: { slug: string }) {
  const [attraction, setAttraction] = useState<Attraction | null>(null);
  const [loading, setLoading] = useState(true);

  const bgSrc = getQueueBg(slug);
  const logoSrc = getAttractionLogo(slug);
  const logoGlow = getLogoGlow(slug, 'strong');

  useEffect(() => {
    async function fetchAttraction() {
      const { data } = await supabase
        .from('attractions')
        .select('id,name,slug,status,wait_time,sort_order,attraction_type,show_times,updated_at')
        .eq('slug', slug)
        .single();

      if (data) setAttraction(data);
      setLoading(false);
    }

    fetchAttraction();

    // Realtime subscription
    const channel = supabase
      .channel(`queue-display-${slug}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'attractions' },
        (payload) => {
          const updated = payload.new as Attraction;
          if (updated.slug === slug) {
            setAttraction(updated);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [slug]);

  if (loading) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '2vw' }}>Loading...</span>
      </div>
    );
  }

  if (!attraction) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#f87171', fontSize: '2vw' }}>Attraction not found</span>
      </div>
    );
  }

  const isOpen = attraction.status === 'OPEN';
  const isClosed = attraction.status === 'CLOSED';
  const isDelayed = attraction.status === 'DELAYED';
  const isAtCapacity = attraction.status === 'AT CAPACITY';

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Full-bleed background image */}
      {bgSrc && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${bgSrc})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            zIndex: 0,
          }}
        />
      )}

      {/* Dark overlay + vignette for text readability */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.75) 100%)',
          zIndex: 1,
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '3vh 5vw',
        }}
      >
        {/* Header — "CURRENT WAIT TIME" */}
        <div style={{ flexShrink: 0, width: '100%' }}>
          <ElectricHeader title="Current Wait Time" fontSize="4vw" />
          <LightningBorder />
        </div>

        {/* Logo */}
        {logoSrc && (
          <div
            style={{
              marginTop: '2vh',
              flexShrink: 0,
              height: '12vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={logoSrc}
              alt={attraction.name}
              style={{
                maxHeight: '100%',
                maxWidth: '50vw',
                objectFit: 'contain',
                filter: logoGlow,
              }}
            />
          </div>
        )}

        {/* Wait time / Status — centred, massive */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 0,
          }}
        >
          {isOpen && (
            <>
              <span
                style={{
                  fontFamily: "var(--font-bebas-neue), 'Bebas Neue', Impact, sans-serif",
                  fontSize: '28vh',
                  lineHeight: 0.85,
                  fontVariantNumeric: 'tabular-nums',
                  color: '#FBBF24',
                  textShadow: '0 0 40px rgba(251,191,36,0.6), 0 0 80px rgba(251,191,36,0.3), 0 4px 20px rgba(0,0,0,0.8)',
                  letterSpacing: '-0.02em',
                }}
              >
                {attraction.wait_time}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-bebas-neue), 'Bebas Neue', Impact, sans-serif",
                  fontSize: '6vh',
                  letterSpacing: '0.3em',
                  color: '#FBBF24',
                  textShadow: '0 0 20px rgba(251,191,36,0.4), 0 2px 10px rgba(0,0,0,0.8)',
                  marginTop: '1vh',
                }}
              >
                Minutes
              </span>
            </>
          )}

          {isClosed && (
            <span
              style={{
                fontFamily: "var(--font-bebas-neue), 'Bebas Neue', Impact, sans-serif",
                fontSize: '14vh',
                letterSpacing: '0.15em',
                color: '#f87171',
                textShadow: '0 0 40px rgba(248,113,113,0.5), 0 4px 20px rgba(0,0,0,0.8)',
              }}
            >
              Closed
            </span>
          )}

          {isDelayed && (
            <span
              style={{
                fontFamily: "var(--font-bebas-neue), 'Bebas Neue', Impact, sans-serif",
                fontSize: '10vh',
                letterSpacing: '0.1em',
                textAlign: 'center',
                lineHeight: 1.1,
                color: '#F59E0B',
                textShadow: '0 0 40px rgba(245,158,11,0.5), 0 4px 20px rgba(0,0,0,0.8)',
              }}
            >
              Technical<br />Delay
            </span>
          )}

          {isAtCapacity && (
            <span
              style={{
                fontFamily: "var(--font-bebas-neue), 'Bebas Neue', Impact, sans-serif",
                fontSize: '10vh',
                letterSpacing: '0.1em',
                textAlign: 'center',
                lineHeight: 1.1,
                color: '#F59E0B',
                textShadow: '0 0 40px rgba(245,158,11,0.5), 0 4px 20px rgba(0,0,0,0.8)',
              }}
            >
              At Capacity
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
