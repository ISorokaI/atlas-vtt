import React, { useEffect, useRef, useState } from 'react';
import { ActionsMenuButton } from '../../../packages/components/shared/ActionsMenuButton';
import type { ContextMenuEntry } from '../../../react/components/context-menu/AtlasContextMenu';
import type { EntryPart } from './entryPatches';

/**
 * A part's text: the note's while the part is not being typed in, the typed
 * text from focus until the note holds what was committed. What arrives from
 * the note never replaces what is being typed.
 */
export function usePartDraft(current: string): {
  value: string;
  focus: () => void;
  change: (text: string) => void;
  /** Ends typing; returns the text to commit, or null when nothing changed. */
  end: () => string | null;
} {
  const [draft, setDraftState] = useState<{ text: string; focused: boolean } | null>(null);
  // Read synchronously: a part ended by a key is not ended again by the blur or unmount that follows.
  const draftRef = useRef(draft);
  const setDraft = (next: { text: string; focused: boolean } | null): void => {
    draftRef.current = next;
    setDraftState(next);
  };
  useEffect(() => {
    if (draftRef.current && !draftRef.current.focused) {
      draftRef.current = null;
      setDraftState(null);
    }
  }, [current]);
  return {
    value: draft?.text ?? current,
    focus: () => setDraft({ text: current, focused: true }),
    change: (text) => setDraft({ text, focused: true }),
    end: () => {
      const typed = draftRef.current?.focused ? draftRef.current.text : null;
      const changed = typed !== null && typed !== current;
      setDraft(changed ? { text: typed, focused: false } : null);
      return changed ? typed : null;
    },
  };
}

export interface EntryRowProps {
  /** Position of the entry in the stored list. */
  index: number;
  name: string;
  text: string;
  noun: string;
  /** Mark of the row's inputs, so the editor can focus a part. */
  rowId: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** The drag handle, under the row's menu. */
  handle?: React.ReactNode;
  onCommit: (part: EntryPart, text: string) => void;
  /** Keys the editor handles for the row: Alt+↑/↓ move it, Mod+Enter in its text adds the next entry, Escape leaves. */
  onRowKey: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, part: EntryPart, pending: () => { part: EntryPart; text: string } | null) => void;
  onMove: (step: 1 | -1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

/** One entry being edited: its name, run in as the card writes it, then its text, and a menu. */
export function EntryRow(props: EntryRowProps): React.JSX.Element {
  const { name, text, noun, rowId } = props;
  const nameDraft = usePartDraft(name);
  const textDraft = usePartDraft(text);
  const finish = (part: EntryPart): void => {
    const done = (part === 'name' ? nameDraft : textDraft).end();
    if (done !== null) props.onCommit(part, done);
  };
  // Text typed in a row that goes (its note changed, the pane closed) is written first.
  const finishRef = useRef(finish);
  finishRef.current = finish;
  useEffect(() => () => {
    finishRef.current('name');
    finishRef.current('text');
  }, []);
  const pendingOf = (part: EntryPart) => (): { part: EntryPart; text: string } | null => {
    const draft = part === 'name' ? nameDraft : textDraft;
    const typed = draft.end();
    return typed === null ? null : { part, text: typed };
  };
  const menu: ContextMenuEntry[] = [
    { type: 'item', label: 'Move up', icon: 'arrow-up', disabled: !props.canMoveUp, onClick: () => props.onMove(-1) },
    { type: 'item', label: 'Move down', icon: 'arrow-down', disabled: !props.canMoveDown, onClick: () => props.onMove(1) },
    { type: 'item', label: 'Duplicate', icon: 'copy', onClick: props.onDuplicate },
    { type: 'item', label: 'Delete', icon: 'trash-2', destructive: true, onClick: props.onDelete },
  ];

  return (
    <div className="atlas-sb-pane-entry" data-entry-row={rowId}>
      <input
        type="text"
        className="atlas-sb-pane-input atlas-sb-pane-entry__name"
        data-entry-part="name"
        value={nameDraft.value}
        placeholder="Name"
        aria-label={`${noun} name`}
        onFocus={nameDraft.focus}
        onChange={(event) => nameDraft.change(event.target.value)}
        onBlur={() => finish('name')}
        onKeyDown={(event) => props.onRowKey(event, 'name', pendingOf('name'))}
      />
      <textarea
        className="atlas-sb-pane-input atlas-sb-pane-textarea atlas-sb-pane-entry__text"
        data-entry-part="text"
        value={textDraft.value}
        rows={1}
        placeholder="Description"
        aria-label={`${noun} description`}
        onFocus={textDraft.focus}
        onChange={(event) => textDraft.change(event.target.value)}
        onBlur={() => finish('text')}
        onKeyDown={(event) => props.onRowKey(event, 'text', pendingOf('text'))}
      />
      <ActionsMenuButton label={`Options for ${name.trim() || noun.toLowerCase()}`} entries={menu} className="atlas-sb-pane-entry__menu" />
      {props.handle}
    </div>
  );
}
