import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Attraction Details' };

export default function AttractionDetailsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
