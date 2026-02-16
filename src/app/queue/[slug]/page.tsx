import type { Metadata } from 'next';
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

const SLUG_NAMES: Record<string, string> = {
  'westlake-witch-trials': 'Westlake Witch Trials',
  'the-bunker': 'The Bunker',
  'drowned': 'Drowned',
  'strings-of-control': 'Strings of Control',
  'night-terrors': 'Night Terrors',
  'signal-loss': 'Signal Loss',
};

export function generateStaticParams() {
  return ATTRACTION_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const name = SLUG_NAMES[slug] || slug;
  return { title: `IC — Queue: ${name}` };
}

export default async function QueueDisplayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <QueueDisplayClient slug={slug} />;
}
