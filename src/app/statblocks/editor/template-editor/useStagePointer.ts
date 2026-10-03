/**
 * What the pointer does over the canvas without a click: the hover outline of
 * the innermost block, and the gap it rests in, which grows a `+` line after
 * 150 ms (§7.6). Both are read from the DOM and leave the card's render alone:
 * the outline is an attribute on the block's frame, the gap state lives here.
 */

import { useEffect, useState, type RefObject } from 'react';
import { gapUnder, sameGap, type CanvasGap } from './canvasGaps';
import { frameAt } from './editorChrome';

export const HOVER_ATTRIBUTE = 'data-te-hover';
/** The frame of the container around the hovered block, which shows its tag. */
export const HOVER_PARENT_ATTRIBUTE = 'data-te-hover-parent';
/** How long the pointer rests in a gap before the `+` line shows. */
export const GAP_DELAY_MS = 150;
/** Elements of the chrome itself: over them the hover and the gap stay as they are. */
const CHROME = '.atlas-te-chrome-control';

function setMark(stage: HTMLElement, attribute: string, element: Element | null): void {
  for (const marked of stage.querySelectorAll(`[${attribute}]`)) if (marked !== element) marked.removeAttribute(attribute);
  element?.setAttribute(attribute, '');
}

/** The id of the innermost block under the pointer, marked on its frame for the outline. */
export function useStageHover(stageRef: RefObject<HTMLElement | null>, sheetSelector: string): string | null {
  const [hovered, setHovered] = useState<string | null>(null);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const over = (event: PointerEvent): void => {
      const target = event.target as Element | null;
      if (target?.closest?.(CHROME)) return;
      const sheet = stage.querySelector<HTMLElement>(sheetSelector);
      const frame = sheet ? frameAt(event.target, sheet) : null;
      setMark(stage, HOVER_ATTRIBUTE, frame);
      setMark(stage, HOVER_PARENT_ATTRIBUTE, frame?.parentElement?.closest('[data-block-id]') ?? null);
      setHovered(frame?.getAttribute('data-block-id') ?? null);
    };
    const leave = (): void => {
      setMark(stage, HOVER_ATTRIBUTE, null);
      setMark(stage, HOVER_PARENT_ATTRIBUTE, null);
      setHovered(null);
    };
    stage.addEventListener('pointerover', over);
    stage.addEventListener('pointerleave', leave);
    return () => {
      stage.removeEventListener('pointerover', over);
      stage.removeEventListener('pointerleave', leave);
      leave();
    };
  }, [stageRef, sheetSelector]);
  return hovered;
}

/** The gap the pointer has rested in for `GAP_DELAY_MS`; null elsewhere, and always while `enabled` is off. */
export function useStageGap(stageRef: RefObject<HTMLElement | null>, enabled: boolean): CanvasGap | null {
  const [gap, setGap] = useState<CanvasGap | null>(null);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !enabled) {
      setGap(null);
      return undefined;
    }
    const win = stage.win;
    let pending: CanvasGap | null = null;
    let timer = 0;
    const move = (event: PointerEvent): void => {
      const target = event.target as Element | null;
      if (!target?.closest || target.closest(CHROME)) return;
      const box = stage.getBoundingClientRect();
      const found = gapUnder(stage, target, { x: event.clientX - box.left, y: event.clientY - box.top });
      if (sameGap(found, pending)) return;
      pending = found;
      win.clearTimeout(timer);
      if (!found) {
        setGap(null);
        return;
      }
      timer = win.setTimeout(() => setGap(found), GAP_DELAY_MS);
    };
    const leave = (): void => {
      pending = null;
      win.clearTimeout(timer);
      setGap(null);
    };
    stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerleave', leave);
    return () => {
      win.clearTimeout(timer);
      stage.removeEventListener('pointermove', move);
      stage.removeEventListener('pointerleave', leave);
    };
  }, [stageRef, enabled]);
  return gap;
}
