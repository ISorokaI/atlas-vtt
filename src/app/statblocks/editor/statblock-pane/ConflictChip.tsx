import React from 'react';
import { Button } from '../../../packages/components/primitives/button';
import type { FieldValue, TemplateField } from '../../model/templateTypes';
import { valueText } from '../../values/valueText';
import { usePaneEdit, type FieldConflict } from './paneEditContext';

/** A value as the chip writes it; an empty one as a dash. */
function shown(value: FieldValue | undefined): string {
  const text = valueText(value).trim();
  return text === '' ? '–' : text;
}

/**
 * A commit the note refused because the value changed there meanwhile
 * (§8.6): "Changed in the note: 14 → 18", with Keep mine (written again over
 * the note's value) and Use the note's (the note's value stays).
 */
export function ConflictChip({ field, conflict }: { field: TemplateField; conflict: FieldConflict }): React.JSX.Element {
  const pane = usePaneEdit();
  const now = pane.read(field).value;
  const text = conflict.canKeepMine ? `Changed in the note: ${shown(conflict.base)} → ${shown(now)}` : 'Changed in the note';

  return (
    <span className="atlas-sb-pane-conflict" role="group" aria-label={`${field.label} conflict`}>
      <span className="atlas-sb-pane-conflict__text">{text}</span>
      {conflict.canKeepMine && (
        <Button type="button" variant="ghost" size="sm" onClick={() => pane.keepMine(field)}>Keep mine</Button>
      )}
      <Button type="button" variant="ghost" size="sm" onClick={() => pane.keepNotes(field)}>Use the note&apos;s</Button>
    </span>
  );
}
