/**
 * Where the narrow inspector's popover stands (§7.4): beside the selected
 * block, on the side with room, else under it, inside the visible canvas.
 */

import { useLayoutEffect, useState, type RefObject } from 'react';
import { observeResize } from '../../../../utils/observeResize';
import { blockFrame } from '../editorChrome';
import type { Box } from '../gapGeometry';

export type BesideSide = 'right' | 'left' | 'below';

export interface BesidePlacement {
  /** In the coordinates of the element the popover is positioned in. */
  left: number;
  top: number;
  side: BesideSide;
}

/** Room between the popover and the block's selection outline, which stands 4 px off the block. */
export const BESIDE_GAP = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * The popover's place for a block's box, all in window coordinates: right of
 * the block where it fits in `view`, else left of it, else under it; its top
 * in line with the block's, kept inside the view.
 */
export function placeBeside(block: Box, view: Box, size: { width: number; height: number }): { left: number; top: number; side: BesideSide } {
  const top = clamp(block.top, view.top, view.bottom - size.height);
  if (block.right + BESIDE_GAP + size.width <= view.right) return { left: block.right + BESIDE_GAP, top, side: 'right' };
  if (block.left - BESIDE_GAP - size.width >= view.left) return { left: block.left - BESIDE_GAP - size.width, top, side: 'left' };
  return { left: clamp(block.left, view.left, view.right - size.width), top: block.bottom + BESIDE_GAP, side: 'below' };
}

/**
 * Places `popover` beside block `id` of the editor's canvas, measured from
 * `origin` (the element it is positioned in), again when the canvas scrolls
 * or resizes and whenever `revision` changes. Null while the block is not
 * drawn.
 */
export function useBesideBlock(
  origin: RefObject<HTMLElement | null>, popover: RefObject<HTMLElement | null>, id: string | null, revision: unknown,
): BesidePlacement | null {
  const [placement, setPlacement] = useState<BesidePlacement | null>(null);
  useLayoutEffect(() => {
    const from = origin.current;
    const stage = from?.closest('.atlas-te')?.querySelector<HTMLElement>('.atlas-te-stage') ?? null;
    const scroller = stage?.closest<HTMLElement>('.atlas-te-canvas__scroller') ?? stage;
    if (!from || !stage || !scroller || id === null) {
      setPlacement(null);
      return undefined;
    }
    const update = (): void => {
      const frame = blockFrame(stage, id);
      const element = popover.current;
      if (!frame || !element) {
        setPlacement(null);
        return;
      }
      const place = placeBeside(frame.getBoundingClientRect(), scroller.getBoundingClientRect(), { width: element.offsetWidth, height: element.offsetHeight });
      const base = from.getBoundingClientRect();
      const next = { left: Math.round(place.left - base.left), top: Math.round(place.top - base.top), side: place.side };
      setPlacement((was) => (was && was.left === next.left && was.top === next.top && was.side === next.side ? was : next));
    };
    update();
    scroller.addEventListener('scroll', update, { passive: true });
    const stop = observeResize([stage, scroller, ...(popover.current ? [popover.current] : [])], update);
    return () => {
      scroller.removeEventListener('scroll', update);
      stop();
    };
  }, [origin, popover, id, revision]);
  return placement;
}
