import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Control — Sign In',
};

export default function ControlLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
