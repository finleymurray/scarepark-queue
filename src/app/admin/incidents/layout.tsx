import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Incidents' };

export default function IncidentsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
