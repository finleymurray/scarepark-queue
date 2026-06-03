'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import QueueDisplayClient from './[slug]/QueueDisplayClient';

/**
 * Query-param queue display: /queue?a=<slug>
 *
 * Unlike /queue/[slug] (which is statically pre-generated and only exists for
 * attractions present at build time), this single static page works for ANY
 * attraction — including ones added mid-season via the wizard — with no rebuild.
 * The slug is read client-side from the ?a= parameter.
 */
function QueueByParam() {
  const params = useSearchParams();
  const slug = params.get('a') || params.get('slug') || '';

  if (!slug) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '2vw' }}>No attraction selected</span>
      </div>
    );
  }

  return <QueueDisplayClient slug={slug} identityPath={`/queue?a=${slug}`} />;
}

export default function QueuePage() {
  return (
    <Suspense fallback={
      <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '2vw' }}>Loading…</span>
      </div>
    }>
      <QueueByParam />
    </Suspense>
  );
}
