import type { FloorplanDef } from './types';
import nightTerrors from './night-terrors';
import signalLoss from './signal-loss';
import stringsOfControl from './strings-of-control';
import theBunker from './the-bunker';
import westlakeWitchTrials from './westlake-witch-trials';

/** Floorplans keyed by attraction slug. Mazes without a CoSWP yet have no entry. */
export const floorplans: Record<string, FloorplanDef> = {
  'night-terrors': nightTerrors,
  'signal-loss': signalLoss,
  'strings-of-control': stringsOfControl,
  'the-bunker': theBunker,
  'westlake-witch-trials': westlakeWitchTrials,
};

export function getFloorplan(slug: string): FloorplanDef | null {
  return floorplans[slug] ?? null;
}
