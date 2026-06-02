import type { Metadata } from 'next';

export const metadata: Metadata = {
  manifest: '/manifest-control.json',
  title: 'Control',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Control',
  },
  icons: {
    icon: '/favicons/control.ico',
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
