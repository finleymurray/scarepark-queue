import QueueDisplayClient from './QueueDisplayClient';

/* ── Static params for every known maze slug ── */
const ATTRACTION_SLUGS = [
  'westlake-witch-trials',
  'the-bunker',
  'drowned',
  'strings-of-control',
  'night-terrors',
  'signal-loss',
];

export function generateStaticParams() {
  return ATTRACTION_SLUGS.map((slug) => ({ slug }));
}

export default async function QueueDisplayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <QueueDisplayClient slug={slug} />;
}
