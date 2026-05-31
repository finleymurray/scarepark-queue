import type { Metadata } from 'next';

export const metadata: Metadata = {
  manifest: '/manifest-admin.json',
  title: 'Admin',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'IC Admin',
  },
  icons: {
    icon: '/favicons/admin.ico',
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
