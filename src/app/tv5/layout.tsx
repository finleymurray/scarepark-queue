import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'IC — TV5: Statics',
};

export default function TV5Layout({ children }: { children: React.ReactNode }) {
  return children;
}
