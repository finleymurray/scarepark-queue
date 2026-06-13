import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CoreLink — Live Demo',
  description: 'See CoreLink running a real scare park: live queue screens, dispatch control, sign-off checklists and operations analytics.',
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
