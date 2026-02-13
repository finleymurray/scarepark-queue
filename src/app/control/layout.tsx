import type { Metadata } from 'next';

export const metadata: Metadata = {
  manifest: '/manifest-control.json',
  title: 'Immersive Core — Control',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'IC Control',
  },
  icons: {
    apple: '/icons/control-512.png',
  },
};

export default function ControlLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
