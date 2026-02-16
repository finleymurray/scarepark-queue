import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'IC — TV Hub',
};

export default function TVLayout({ children }: { children: React.ReactNode }) {
  return children;
}
