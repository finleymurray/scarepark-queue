import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'New Attraction' };

export default function NewAttractionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
