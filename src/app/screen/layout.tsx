import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'IC — Screen Controller',
};

export default function ScreenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
