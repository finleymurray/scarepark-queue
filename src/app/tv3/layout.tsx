import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'IC — TV3: Show Schedule',
};

export default function TV3Layout({ children }: { children: React.ReactNode }) {
  return children;
}
