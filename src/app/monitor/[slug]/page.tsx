import MazeClient from './MazeClient';

// Static export: pre-generate a page per maze. New mazes ship with their
// floorplan art, so extending this list is part of adding a maze anyway.
export function generateStaticParams() {
  return [
    'night-terrors',
    'signal-loss',
    'strings-of-control',
    'the-bunker',
    'westlake-witch-trials',
    'drowned',
  ].map((slug) => ({ slug }));
}

export const dynamicParams = false;

export default function MonitorMazePage() {
  return <MazeClient />;
}
