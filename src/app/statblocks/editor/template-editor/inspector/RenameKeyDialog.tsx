import React, { useEffect, useId, useRef, useState } from 'react';
import { Button } from '../../../../packages/components/primitives/button';
import { renameKeyProblem } from '../../../model/fieldOps';
import type { FieldKey, StatblockTemplate, TemplateField } from '../../../model/templateTypes';
import { EditorDialog } from './EditorDialog';

export interface RenameKeyDialogProps {
  /** An element of the editor: the dialog opens in its window. */
  anchor: HTMLElement;
  field: TemplateField;
  template: StatblockTemplate;
  /** How many statblocks use the template. */
  statblocks: number;
  onRename: (to: FieldKey) => void;
  onClose: () => void;
}

/** What renaming does to the statblocks, in a sentence; null where none uses the template. */
function statblocksText(count: number, key: FieldKey): string | null {
  if (count === 0) return null;
  return count === 1
    ? `The statblock that uses this template keeps its value under “${key}”, where the template still finds it.`
    : `The ${count} statblocks that use this template keep their values under “${key}”, where the template still finds them.`;
}

/**
 * Rename key (§7.10, §8.8): the key the statblocks store the field under.
 * The template goes on reading the old key as a former key, so no value is
 * lost; the notes themselves are not rewritten here.
 */
export function RenameKeyDialog({ anchor, field, template, statblocks, onRename, onClose }: RenameKeyDialogProps): React.JSX.Element {
  const inputId = useId();
  const problemId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [key, setKey] = useState(field.key);
  const to = key.trim();
  const changed = to !== field.key;
  const problem = changed ? renameKeyProblem(template, field.key, to) : null;
  const notes = statblocksText(statblocks, field.key);

  useEffect(() => { inputRef.current?.select(); }, []);

  const rename = (): void => {
    if (changed && problem === null) onRename(to);
  };

  return (
    <EditorDialog
      anchor={anchor}
      title="Rename key"
      onClose={onClose}
      footer={(
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="button" size="sm" disabled={!changed || problem !== null} onClick={rename}>Rename</Button>
        </>
      )}
    >
      <p className="atlas-te-dialog__text">
        Statblocks store {field.label || field.key} under this key. The old key stays readable, so no value is lost.
      </p>
      <div className="atlas-te-dialog__field">
        <label htmlFor={inputId} className="atlas-te-dialog__label">New key</label>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          className="atlas-te-input atlas-te-input--code"
          value={key}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? problemId : undefined}
          onChange={(event) => setKey(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
            event.preventDefault();
            rename();
          }}
        />
        {problem && <p id={problemId} className="atlas-te-setting__problem">{problem}</p>}
      </div>
      {notes && <p className="atlas-te-dialog__text">{notes}</p>}
    </EditorDialog>
  );
}
