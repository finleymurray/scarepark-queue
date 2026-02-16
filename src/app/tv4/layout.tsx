import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'IC — TV4: Carousel',
};

export default function TV4Layout({ children }: { children: React.ReactNode }) {
  return children;
}
