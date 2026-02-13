import type { Metadata } from 'next';

export const metadata: Metadata = {
  manifest: '/manifest-signoff.json',
  title: 'Immersive Core — Sign-Off',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'IC Sign-Off',
  },
  icons: {
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
