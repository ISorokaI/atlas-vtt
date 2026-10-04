import { Container, Sprite, type Renderer, type Texture } from 'pixi.js';
import type { FogBounds } from '../../types/fogTypes';
import type { LayerVisibility } from '../playerSafeFrame';
import { FogLift } from './FogLift';
import type { FogReveal } from './fogReveal';
import { resolveFogPreviewAlpha } from './fogVisibilityPolicy';

/**
 * The painted fog on the canvas, drawn from the fog canvas: as the GM painted it (`painted`,
 * translucent in GM view), and as the players see it, lifted where the party has explored or
 * perceives now (`FogLift`), once `followSight` gave it a reveal. The players' fog shows in a
 * capture for the player window and on the GM's canvas in session view. `view` carries whether
 * any fog shows and how opaque it is.
 */
export class FogDisplay {
  readonly view = new Container({ label: 'fogDisplay', eventMode: 'none' });
  private readonly painted: Sprite;
  private lift: FogLift | null = null;
  private texture: Texture;
  private bounds: FogBounds;
  private playersShown = false;

  constructor(texture: Texture, bounds: FogBounds) {
    this.texture = texture;
    this.bounds = bounds;
    this.painted = new Sprite({ texture, eventMode: 'none' });
    this.view.addChild(this.painted);
    this.place();
  }

  /** The fog canvas' texture changed, with the world rectangle it covers. */
  setTexture(texture: Texture, bounds: FogBounds): void {
    this.texture = texture;
    this.bounds = bounds;
    this.painted.texture = texture;
    this.place();
  }

  /** From now on the players' fog is lifted by `reveal`; where the lift cannot be drawn it stays as painted. */
  followSight(renderer: Renderer, reveal: () => FogReveal | null): void {
    if (this.lift) return;
    this.lift = FogLift.create(renderer, this.texture, reveal);
    if (!this.lift) return;
    this.view.addChild(this.lift.view);
    this.place();
    this.showPlayers(this.playersShown);
  }

  /** Whether the canvas shows the players' fog (session view) rather than the GM's. */
  showPlayers(shown: boolean): void {
    this.playersShown = shown;
    this.view.alpha = resolveFogPreviewAlpha({ isPlayerView: false, isGMView: !shown });
    this.painted.visible = !shown || !this.lift;
    if (this.lift) this.lift.view.visible = shown;
  }

  /** The fog as the players see it, for one capture. */
  playerViewLayers(): LayerVisibility[] {
    return [{ layer: this.view, visible: this.view.visible, alpha: 1 }, ...this.faces(true)];
  }

  /** The fog as the GM view shows it, also while the canvas is in session view: for a picture of the scene. */
  gmViewLayers(): LayerVisibility[] {
    return [{ layer: this.view, visible: this.view.visible, alpha: resolveFogPreviewAlpha({ isPlayerView: false, isGMView: true }) }, ...this.faces(false)];
  }

  destroy(): void {
    this.lift?.destroy();
    this.lift = null;
  }

  private faces(players: boolean): LayerVisibility[] {
    if (!this.lift) return [];
    return [
      { layer: this.painted, visible: !players },
      { layer: this.lift.view, visible: players },
    ];
  }

  private place(): void {
    const { x, y, width, height } = this.bounds;
    this.painted.position.set(x, y);
    this.painted.width = width;
    this.painted.height = height;
    this.lift?.setFog(this.texture, this.bounds);
  }
}
