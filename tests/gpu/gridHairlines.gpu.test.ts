import '../setup/obsidianDom';
import { Container, Sprite, Texture, WebGLRenderer, type Application } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import { describe, expect, it } from 'vitest';
import { GridSystem } from '../../src/app/grid/GridSystem';

const VIEW = 300;
const MAP = 2048;
/** A cell size the freehand tool or the alignment gives: no whole number, so every line has its own phase. */
const SIZE = 68.49;
const OFFSET = 13.3;

function plainMap(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = MAP;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, MAP, MAP);
  return Texture.from(canvas);
}

/**
 * A grid line one map pixel wide is thinner than a device pixel once the map is zoomed out.
 * Drawn without samples (the back buffer at resolution 2, or no MSAA on the device) such a line
 * fell between pixel centres, and with a cell size that is no whole number some lines vanished
 * at one zoom and others at the next.
 */
describe('grid lines thinner than a pixel', () => {
  for (const resolution of [1, 1.25, 1.5, 2]) {
    it(`show along their whole length at every zoom, at resolution ${resolution}`, async () => {
      const renderer = new WebGLRenderer();
      await renderer.init({ width: VIEW, height: VIEW, antialias: false, backgroundAlpha: 1, resolution, preserveDrawingBuffer: true });
      const viewport = new Container();
      const map = viewport.addChild(new Sprite(plainMap()));
      const grid = new GridSystem({ renderer } as unknown as Application, viewport as unknown as Viewport, map, {
        size: SIZE, offsetX: OFFSET, offsetY: OFFSET, color: 0x000000, alpha: 1, lineWidth: 1,
      });
      const pixels = Math.round(VIEW * resolution);
      const gaps: string[] = [];
      try {
        for (let scale = 0.25; scale <= 3; scale += 0.0731) {
          viewport.scale.set(scale);
          viewport.position.set(-37.3 * scale, -41.7 * scale);
          viewport.emit('zoomed', {});
          renderer.render(viewport);
          const context = new OffscreenCanvas(pixels, pixels).getContext('2d')!;
          context.drawImage(renderer.canvas, 0, 0);
          const data = context.getImageData(0, 0, pixels, pixels).data;
          for (let worldX = OFFSET; worldX < MAP; worldX += SIZE) {
            const x = Math.floor((worldX - 37.3) * scale * resolution);
            if (x < 2 || x > pixels - 3) continue;
            let missing = 0;
            for (let y = 2; y < pixels - 2; y++) {
              const row = (y * pixels + x) * 4;
              // The stroke lies on one side of its line (`alignment: 0`): look a pixel either way.
              if (Math.min(data[row - 4]!, data[row]!, data[row + 4]!) > 250) missing++;
            }
            if (missing > 0) gaps.push(`zoom ${scale.toFixed(3)}: line at ${worldX.toFixed(2)} missing in ${missing} rows`);
          }
        }
        expect(gaps).toEqual([]);
      } finally {
        grid.destroy();
        renderer.destroy();
      }
    });
  }
});
