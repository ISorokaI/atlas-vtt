import React from 'react';
import { Button } from '../../../../packages/components/primitives/button';
import type { SessionSnapshot } from '../sessionTypes';

/** The line under the card while nothing else needs it (§12.1). */
export const GESTURE_HINT = 'Point at a part to change it · / adds · right-click for more';

export interface TemplateFooterLineProps {
  snapshot: SessionSnapshot;
  /** "Shown as a hover card" while the card is not at the note's width; null at the note's. */
  showAsLine: string | null;
  onBackToNote: () => void;
  /** Makes an editable copy of a built-in; unset while one is being made. */
  onMakeCopy?: (() => void) | undefined;
}

/**
 * The template editor's line under the card (§2.4), one at a time: what a
 * built-in or a newer template allows, the width the card is shown at, else
 * the gesture hint. It sits in the footer slot, so nothing in it moves the card.
 */
export function TemplateFooterLine({ snapshot, showAsLine, onBackToNote, onMakeCopy }: TemplateFooterLineProps): React.JSX.Element {
  const line = ((): React.ReactNode => {
    if (snapshot.readOnlyReason === 'newer') return <span>This template is from a newer Atlas. Update Atlas to edit it.</span>;
    if (snapshot.readOnlyReason === 'built-in') {
      return (
        <>
          <span>Built-in template. Make a copy to change it.</span>
          <Button type="button" variant="ghost" size="sm" disabled={!onMakeCopy} onClick={() => onMakeCopy?.()}>Make a copy</Button>
        </>
      );
    }
    if (showAsLine) {
      return (
        <>
          <span>{showAsLine}</span>
          <Button type="button" variant="ghost" size="sm" onClick={onBackToNote}>Back to note</Button>
        </>
      );
    }
    return <span>{GESTURE_HINT}</span>;
  })();
  return <div className="atlas-te-footer-line">{line}</div>;
}
