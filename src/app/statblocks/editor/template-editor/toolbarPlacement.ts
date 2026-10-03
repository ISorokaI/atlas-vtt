/** Where the block toolbar stands (§7.6): above its block, else below; inside the visible canvas. */

import type { Box } from './gapGeometry';

export interface ToolbarPlacement {
  /** In the coordinates of the layer the toolbar is drawn in. */
  left: number;
  top: number;
  /** Below the block, because there was no room above it. */
  below: boolean;
  /** The block is scrolled out of sight: no toolbar. */
  hidden: boolean;
}

/** Room between the toolbar and the block's selection outline, which stands 4 px off the block. */
export const TOOLBAR_GAP = 8;

/**
 * The toolbar's place for a block's box, all in window coordinates: `view` is
 * the visible part of the canvas, `layer` the box of the layer it is drawn in.
 * Left-aligned with the block, kept inside the view sideways; above it where
 * it fits, below it otherwise, and against the view's top edge where neither
 * does (a block taller than the view).
 */
export function placeToolbar(block: Box, view: Box, layer: Box, size: { width: number; height: number }): ToolbarPlacement {
  const hidden = block.bottom < view.top || block.top > view.bottom;
  const above = block.top - TOOLBAR_GAP - size.height;
  const below = block.bottom + TOOLBAR_GAP;
  const fitsAbove = above >= view.top;
  const fitsBelow = below + size.height <= view.bottom;
  const top = fitsAbove ? above : fitsBelow ? below : view.top + TOOLBAR_GAP;
  const maxLeft = Math.max(view.left, view.right - size.width);
  const left = Math.min(Math.max(block.left, view.left), maxLeft);
  return { left: left - layer.left, top: top - layer.top, below: !fitsAbove && fitsBelow, hidden };
}
