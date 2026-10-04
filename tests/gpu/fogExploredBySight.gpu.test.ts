import { Container, RenderTexture, Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { FogDisplay } from '../../src/app/pixi/fog/FogDisplay';
import { FogLift } from '../../src/app/pixi/fog/FogLift';
import { captureWithLayerVisibility } from '../../src/app/pixi/playerSafeFrame';
import { readRgba } from '../../src/app/pixi/lighting/engine/__tests__/gpuTestUtils';
import { SIZE } from '../../src/app/pixi/lighting/__tests__/rendererHarness';
import { RIGHT_ROOM, memoryScenes, reveal, type MemoryScene, type MemorySceneOptions } from './exploredMemoryScene';

/** Fog painted over the whole map: an opaque canvas as the fog compositor draws it. */
function paintedFog(): Texture {
  const canvas = createEl('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext('2d')!;
  context.fillStyle = 'black';
  context.fillRect(0, 0, SIZE, SIZE);
  return Texture.from(canvas);
}

interface FoggedScene extends MemoryScene {
  /** How opaque the players' fog is at a point of the map (0..255). */
  fogAt: (x: number, y: number) => number;
}

describe('painted fog in the players\' view', () => {
  const { scene } = memoryScenes();

  /** The two rooms in daylight, painted over with fog, and the players' fog drawn from them. */
  async function fogged(options: MemorySceneOptions = {}): Promise<FoggedScene> {
    const rooms = await scene({ ...options, lighting: { ambient: 1, ...options.lighting } });
    rooms.store.getState().addFogOperation({ type: 'rectangle', isErasing: false, x: 0, y: 0, width: SIZE, height: SIZE });
    const fog = paintedFog();
    const lift = FogLift.create(rooms.renderer, fog, () => rooms.lighting.fogReveal())!;
    expect(lift).not.toBeNull();
    lift.setFog(fog, { x: 0, y: 0, width: SIZE, height: SIZE });
    const root = new Container();
    root.addChild(lift.view);
    const target = RenderTexture.create({ width: SIZE, height: SIZE });
    const fogAt = (x: number, y: number): number => {
      rooms.renderer.render({ container: root, target, clear: true, clearColor: [0, 0, 0, 0] });
      return readRgba(rooms.renderer, target)[(y * SIZE + x) * 4 + 3]!;
    };
    return { ...rooms, fogAt };
  }

  it('lifts where the party sees, and nowhere past the wall', async () => {
    const { fogAt } = await fogged();
    // The party stands at (60, 128) and sees 70 px; the wall runs down x = 128.
    expect(fogAt(60, 128)).toBe(0);
    expect(fogAt(100, 128)).toBe(0);
    expect(fogAt(200, 128)).toBe(255);
    expect(fogAt(140, 128)).toBe(255);
    expect(fogAt(60, 10)).toBe(255);
  });

  it('stays lifted where the party has been, while the scene remembers', async () => {
    const { fogAt, moveParty } = await fogged();
    moveParty(60, 40);
    expect(fogAt(60, 40)).toBe(0);
    expect(fogAt(60, 180)).toBe(0);
  });

  it('closes again behind the party in a scene that remembers nothing', async () => {
    const { fogAt, moveParty } = await fogged({ lighting: { exploredMemory: false } });
    expect(fogAt(60, 180)).toBe(0);
    moveParty(60, 40);
    expect(fogAt(60, 40)).toBe(0);
    expect(fogAt(60, 180)).toBe(255);
  });

  it('lifts where the GM revealed the memory, and keeps what the party sees when the GM forgets it all', async () => {
    const { fogAt, lighting } = await fogged();
    lighting.editExplored(reveal(RIGHT_ROOM));
    expect(fogAt(200, 128)).toBe(0);
    lighting.resetExplored();
    expect(fogAt(200, 128)).toBe(255);
    expect(fogAt(60, 128)).toBe(0);
  });

  it('stays as painted while token vision hides nothing', async () => {
    const { fogAt, lighting, store } = await fogged();
    store.getState().setSceneLighting({ tokenVision: false });
    expect(lighting.fogReveal()).toBeNull();
    expect(fogAt(60, 128)).toBe(255);
  });

  it('stays as painted with lighting off', async () => {
    const { fogAt, lighting, store } = await fogged();
    store.getState().setSceneLighting({ enabled: false });
    expect(lighting.fogReveal()).toBeNull();
    expect(fogAt(60, 128)).toBe(255);
  });

  it('draws what the party perceives only while the scene has painted fog', async () => {
    const { lighting, store } = await fogged();
    expect(lighting.fogReveal()?.perceived).toBeTruthy();
    store.getState().clearFog();
    expect(lighting.fogReveal()).toBeNull();
  });

  it('shows the players the lifted fog in their frame, and the GM the fog as painted', async () => {
    const rooms = await scene({ lighting: { ambient: 1 } });
    rooms.store.getState().addFogOperation({ type: 'rectangle', isErasing: false, x: 0, y: 0, width: SIZE, height: SIZE });
    const fog = paintedFog();
    const display = new FogDisplay(fog, { x: 0, y: 0, width: SIZE, height: SIZE });
    display.followSight(rooms.renderer, () => rooms.lighting.fogReveal());
    display.showPlayers(false);
    const root = new Container();
    root.addChild(display.view);
    const target = RenderTexture.create({ width: SIZE, height: SIZE });
    const alphaAt = (x: number, y: number): number => {
      rooms.renderer.render({ container: root, target, clear: true, clearColor: [0, 0, 0, 0] });
      return readRgba(rooms.renderer, target)[(y * SIZE + x) * 4 + 3]!;
    };
    try {
      // The GM's view: translucent and whole, where the party stands too.
      expect(alphaAt(60, 128)).toBeCloseTo(128, -1);
      const players: number[] = [];
      captureWithLayerVisibility(display.playerViewLayers(), () => undefined, () => players.push(alphaAt(60, 128), alphaAt(200, 128)));
      expect(players).toEqual([0, 255]);
      expect(alphaAt(60, 128)).toBeCloseTo(128, -1);
      // Session view holds the players' fog on the GM's canvas.
      display.showPlayers(true);
      expect([alphaAt(60, 128), alphaAt(200, 128)]).toEqual([0, 255]);
      // A picture of the scene is always the GM's.
      const pictures: number[] = [];
      captureWithLayerVisibility(display.gmViewLayers(), () => undefined, () => pictures.push(alphaAt(60, 128)));
      expect(pictures[0]).toBeCloseTo(128, -1);
    } finally {
      display.destroy();
      root.destroy({ children: true });
      target.destroy(true);
      fog.destroy(true);
    }
  });
});
