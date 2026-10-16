import { everyLevelObjects, levelObjects } from '../levels/levelObjects';
import type { LevelView } from '../levels/sceneLevels';
import type { FogOperation } from '../types/fogTypes';
import type { FogStyle } from './fogStyle';

type FogRecord = Readonly<Record<string, FogOperation>>;

/** What `heldFog` reads of a view's state. */
export interface FogHoldState {
  activeTool: string;
  isPlayerView: boolean;
  fogStyle: FogStyle;
  fogHeld: FogRecord | null;
  objects: { fog: FogRecord };
}

/**
 * The fog the players are kept on: under cloud reveal, while the GM's view has the fog or eraser
 * tool, the fog of every level from when the tool was taken up; otherwise none, and they see the fog as it is.
 */
export function heldFog(state: FogHoldState): FogRecord | null {
  const editing = state.activeTool === 'fog' || state.activeTool === 'eraser';
  if (!editing || state.isPlayerView || !state.fogStyle.clouds) return null;
  return state.fogHeld ?? everyLevelObjects(state).fog;
}

/** The held fog of every level as objects `levelObjects` reads, one per hold, so its result keeps its identity. */
const heldObjects = new WeakMap<FogRecord, { fog: FogRecord }>();

/**
 * The fog the players see, of the level the view shows (`levelObjects`). Everything that shows
 * them fog or decides by it reads this: the player frame, the tokens and door badges fog hides
 * from them, and what an online table sends. A hold keeps the fog of every level, so showing
 * another level while it lasts shows that level's fog from when the tool was taken up.
 */
export function playersFog(state: { fogHeld?: FogRecord | null | undefined; objects: { fog: FogRecord } } & LevelView): FogRecord {
  if (!state.fogHeld) return levelObjects(state).fog;
  let objects = heldObjects.get(state.fogHeld);
  if (!objects) heldObjects.set(state.fogHeld, objects = { fog: state.fogHeld });
  return levelObjects({ objects, levels: state.levels, viewedLevel: state.viewedLevel }).fog;
}
