import { describe, expect, it } from 'vitest';
import { Sprite, Texture, type Renderer } from 'pixi.js';
import { FogDisplay } from '../../src/app/pixi/fog/FogDisplay';
import { captureWithLayerVisibility } from '../../src/app/pixi/playerSafeFrame';

const BOUNDS = { x: -200, y: -200, width: 1400, height: 1400 };

describe('FogDisplay', () => {
  it('shows the players the fog as painted where the lift cannot be drawn', () => {
    const display = new FogDisplay(Texture.WHITE, BOUNDS);
    display.followSight({ name: 'canvas' } as unknown as Renderer, () => {
      throw new Error('no reveal is read without a lift');
    });
    const painted = display.view.children[0] as Sprite;
    expect(display.view.children).toHaveLength(1);
    expect(painted.position.x).toBe(-200);
    expect(painted.width).toBe(1400);

    display.showPlayers(false);
    expect(display.view.alpha).toBe(0.5);
    const inFrame: number[] = [];
    captureWithLayerVisibility(display.playerViewLayers(), () => undefined, () => inFrame.push(display.view.alpha, painted.visible ? 1 : 0));
    expect(inFrame).toEqual([1, 1]);
    expect(display.view.alpha).toBe(0.5);

    display.showPlayers(true);
    expect(display.view.alpha).toBe(1);
    expect(painted.visible).toBe(true);
    display.destroy();
  });
});
