import React, { useEffect, useRef, useState } from 'react';
import type { FieldValue } from '../../model/templateTypes';
import type { EntryPart } from './entryPatches';

/** Text typed into a part, and the entry typing started on, which the commit is based on. */
export interface TypedPart {
  text: string;
  from: FieldValue;
}

interface Draft extends TypedPart {
  focused: boolean;
  /** The part's text when typing started. */
  started: string;
}

/**
 * A part's text: the note's while the part is not being typed in, the typed
 * text from focus until the note holds what was committed. What arrives from
 * the note never replaces what is being typed; the commit is based on the
 * entry typing started on, so the note's own change meanwhile (another
 * writer, a reorder) is found by the patcher or reported, never overwritten.
 */
export function usePartDraft(current: string, item: FieldValue): {
  value: string;
  focus: () => void;
  change: (text: string) => void;
  /** Ends typing; returns the text to commit, or null when nothing changed. */
  end: () => TypedPart | null;
} {
  const [draft, setDraftState] = useState<Draft | null>(null);
  // Read synchronously: a part ended by a key is not ended again by the blur or unmount that follows.
  const draftRef = useRef(draft);
  const setDraft = (next: Draft | null): void => {
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
    focus: () => setDraft({ text: current, focused: true, started: current, from: item }),
    change: (text) => {
      const typing = draftRef.current?.focused ? draftRef.current : null;
      setDraft({ text, focused: true, started: typing?.started ?? current, from: typing?.from ?? item });
    },
    end: () => {
      const typed = draftRef.current?.focused ? draftRef.current : null;
      const changed = typed !== null && typed.text !== typed.started;
      setDraft(changed ? { ...typed, focused: false } : null);
      return changed ? { text: typed.text, from: typed.from } : null;
    },
  };
}

/** What a key that ends typing takes along: the part, its text and the entry typing started on. */
export interface PendingPart extends TypedPart {
  part: EntryPart;
}

export interface EntryRowProps {
  /** Position of the entry in the stored list. */
  index: number;
  /** The entry as the note holds it now. */
  item: FieldValue;
  name: string;
  text: string;
  noun: string;
  /** Mark of the row's inputs, so the editor can focus a part. */
  rowId: string;
  /** The entry's identity in its list: the handle in its gutter drags and opens its menu by it (spec §7.2). */
  itemKey: string;
  /** Writes typed text; `from` is the entry typing started on. */
  onCommit: (part: EntryPart, text: string, from: FieldValue) => void;
  /** Keys the editor handles for the row: Alt+↑/↓ move it, Mod+Enter in its text adds the next entry, Escape leaves. */
  onRowKey: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, part: EntryPart, pending: () => PendingPart | null) => void;
  /** Hands the editor what is being typed in the row (a drop takes it along); null takes it back. */
  registerTyping: (rowId: string, typed: (() => PendingPart | null) | null) => void;
}

/** One entry being edited: its name, run in as the card writes it, then its text. Its menu and handle stand in the gutter. */
export function EntryRow(props: EntryRowProps): React.JSX.Element {
  const { item, name, text, noun, rowId, registerTyping } = props;
  const nameDraft = usePartDraft(name, item);
  const textDraft = usePartDraft(text, item);
  const finish = (part: EntryPart): void => {
    const done = (part === 'name' ? nameDraft : textDraft).end();
    if (done !== null) props.onCommit(part, done.text, done.from);
  };
  // Text typed in a row that goes (its note changed, the pane closed) is written first.
  const finishRef = useRef(finish);
  finishRef.current = finish;
  useEffect(() => () => {
    finishRef.current('name');
    finishRef.current('text');
  }, []);
  const pendingOf = (part: EntryPart) => (): PendingPart | null => {
    const typed = (part === 'name' ? nameDraft : textDraft).end();
    return typed === null ? null : { part, ...typed };
  };
  const typedRef = useRef(() => pendingOf('name')() ?? pendingOf('text')());
  typedRef.current = () => pendingOf('name')() ?? pendingOf('text')();
  useEffect(() => {
    registerTyping(rowId, () => typedRef.current());
    return () => registerTyping(rowId, null);
  }, [registerTyping, rowId]);

  return (
    <div className="atlas-sb-pane-entry" data-entry-row={rowId} data-item-key={props.itemKey}>
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
    </div>
  );
}
