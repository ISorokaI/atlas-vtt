import React, { useEffect, useState } from 'react';
import { SegmentedControl, type SegmentedOption } from '../../../packages/components/primitives/SegmentedControl';
import {
  STATBLOCK_FEED_MAX_WIDTH, STATBLOCK_PREVIEW_MAX_WIDTH, STATBLOCK_PREVIEW_WIDE_FROM, STATBLOCK_PREVIEW_WIDE_MAX_WIDTH,
} from '../../render/statblockSurfaceWidths';

/** The surfaces a statblock shows on, as the canvas can be set to them (§7.4). */
export type PreviewWidth = 'hover' | 'feed' | 'pane';

const OPTIONS: ReadonlyArray<SegmentedOption<PreviewWidth>> = [
  { value: 'hover', label: 'Hover' },
  { value: 'feed', label: 'Feed' },
  { value: 'pane', label: 'Pane' },
];

/**
 * The card's width for a choice, in CSS pixels: the hover preview's in a
 * window this wide, the DM screen's widest feed, or none (the canvas's own,
 * as wide as a pane gives it).
 */
export function previewWidthOf(choice: PreviewWidth, windowWidth: number): number | undefined {
  if (choice === 'hover') return windowWidth >= STATBLOCK_PREVIEW_WIDE_FROM ? STATBLOCK_PREVIEW_WIDE_MAX_WIDTH : STATBLOCK_PREVIEW_MAX_WIDTH;
  if (choice === 'feed') return STATBLOCK_FEED_MAX_WIDTH;
  return undefined;
}

/** The chosen width and the card width it gives in the window `rootRef` lives in, which may be a popout. */
export function usePreviewWidth(rootRef: { readonly current: HTMLElement | null }): {
  choice: PreviewWidth;
  setChoice: (choice: PreviewWidth) => void;
  width: number | undefined;
} {
  const [choice, setChoice] = useState<PreviewWidth>('pane');
  const [windowWidth, setWindowWidth] = useState(0);
  useEffect(() => {
    const win = rootRef.current?.win;
    if (!win || choice !== 'hover') return undefined;
    const measure = (): void => setWindowWidth(win.innerWidth);
    measure();
    win.addEventListener('resize', measure);
    return () => win.removeEventListener('resize', measure);
  }, [rootRef, choice]);
  return { choice, setChoice, width: previewWidthOf(choice, windowWidth) };
}

/** Hover · Feed · Pane in the template editor's header. */
export function PreviewWidthChips({ value, onChange }: { value: PreviewWidth; onChange: (choice: PreviewWidth) => void }): React.JSX.Element {
  return <SegmentedControl value={value} options={OPTIONS} onChange={onChange} ariaLabel="Preview width" className="atlas-te-widths" />;
}
