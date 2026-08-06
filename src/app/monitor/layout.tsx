import type { Metadata } from 'next';

export const metadata: Metadata = {
  manifest: '/manifest-monitor.json',
  title: 'Monitor',
  description: 'Maze safety monitoring — floorplans, CCTV and safety equipment.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Monitor',
  },
  icons: {
    icon: '/favicons/monitor.ico',
    apple: '/icons/monitor-512.png',
  },
};

export default function MonitorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
