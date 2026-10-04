import type { Texture } from 'pixi.js';
import type { FogOperation } from '../../types/fogTypes';
import type { MapBounds } from '../../vision/visibility';

/**
 * What lifts painted fog in the players' view: world-space textures over the map
 * (`[0, width] × [0, height]`) whose red is the share of a texel the party has explored or
 * perceives now. Scene lighting hands it out only while token vision hides something and the
 * scene has painted fog, so without one (lighting off, no vision token, the Canvas fallback) the
 * fog stays as painted.
 */
export interface FogReveal {
  /** The scene's explored memory; null while the scene remembers nothing. */
  explored: Texture | null;
  /** What the vision tokens perceive now (`PerceivedNow`). */
  perceived: Texture;
  map: MapBounds;
}

/** Whether a scene holds painted fog: anything a fog stroke painted, erased or not. */
export function hasPaintedFog(fog: Record<string, FogOperation> | undefined): boolean {
  for (const id in fog) if (!fog[id]!.isErasing) return true;
  return false;
}
