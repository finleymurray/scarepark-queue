import type { Metadata } from 'next';

export const metadata: Metadata = {
  manifest: '/manifest-signoff.json',
  title: 'Sign-Off',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Sign-Off',
  },
  icons: {
    icon: '/favicons/signoff.ico',
    apple: '/icons/signoff-512.png',
  },
};

export default function SignoffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
