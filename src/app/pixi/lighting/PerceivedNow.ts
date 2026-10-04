import type { Renderer, Texture } from 'pixi.js';
import type { ExploredShapes } from '../../vision/exploredShapes';
import type { SeenSpot } from '../../vision/perception';
import type { MapBounds } from '../../vision/visibility';
import { ExploredTexture } from './ExploredTexture';

/**
 * What the vision tokens perceive now, in a world-space texture over the map like the explored
 * memory's: red is 1 where a sense that shows the map perceives it (`perceivedShapes`) and in
 * the footprints of the tokens shown where it is dark. It is drawn anew whenever either changes.
 * It lifts painted fog in the players' view (`FogReveal`) where the memory does not (a scene that
 * remembers nothing, a memory the GM forgot), so it exists only while the scene has painted fog.
 */
export class PerceivedNow {
  private texture: ExploredTexture | null = null;
  private bounds: MapBounds | null = null;
  /** What the texture holds; null when it must be drawn anew. */
  private drawn: { shapes: ExploredShapes | null; spots: readonly SeenSpot[] } | null = null;

  constructor(private readonly renderer: Renderer) {}

  get current(): Texture | null {
    return this.texture?.texture ?? null;
  }

  /** The map the texture lies over. */
  get map(): MapBounds | null {
    return this.bounds;
  }

  /** Draws what is perceived now over a map of `bounds`; without `wanted` the texture goes. */
  sync(wanted: boolean, bounds: MapBounds, shapes: ExploredShapes | null, spots: readonly SeenSpot[]): void {
    if (!wanted) {
      this.release();
      return;
    }
    if (!this.texture || this.bounds?.width !== bounds.width || this.bounds.height !== bounds.height) {
      this.release();
      this.texture = new ExploredTexture(this.renderer, bounds);
      this.bounds = bounds;
    }
    if (this.drawn?.shapes === shapes && this.drawn.spots === spots) return;
    this.drawn = { shapes, spots };
    this.texture.clear();
    if (shapes) this.texture.add(shapes);
    const footprints = spots.filter((spot) => spot.polygon.length >= 3).map((spot) => spot.polygon);
    if (footprints.length > 0) this.texture.add({ polygons: footprints, clip: null });
  }

  /** A restored context left the texture blank: the next `sync` draws it anew. */
  invalidate(): void {
    this.drawn = null;
  }

  release(): void {
    this.texture?.destroy();
    this.texture = null;
    this.bounds = null;
    this.drawn = null;
  }
}
