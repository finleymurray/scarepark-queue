import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Monitor — CoreLink',
  description: 'Maze safety monitoring — floorplans, E-Stops and safety equipment.',
};

export default function MonitorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
