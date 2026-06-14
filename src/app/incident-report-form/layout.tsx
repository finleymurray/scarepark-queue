import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Report an Incident',
  description: 'File an incident report — for park staff, no login needed.',
};

export default function IncidentReportFormLayout({ children }: { children: React.ReactNode }) {
  return children;
}
