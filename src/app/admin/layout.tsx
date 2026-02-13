import type { Metadata } from 'next';

export const metadata: Metadata = {
  manifest: '/manifest-admin.json',
  title: 'Immersive Core — Admin',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'IC Admin',
  },
  icons: {
    apple: '/icons/admin-512.png',
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
