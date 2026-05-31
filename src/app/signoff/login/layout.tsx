import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'IC — Sign-Off Login',
};

export default function SignoffLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
