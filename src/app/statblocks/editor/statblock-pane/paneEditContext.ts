import { createContext, useContext } from 'react';
import type { App } from 'obsidian';
import type { FieldKey, FieldValue, TemplateField } from '../../model/templateTypes';
import type { NotePatch } from '../../notes/patchTypes';
import type { SheetState } from '../../render/sheetState';
import type { FieldRead, FieldRecord } from '../../values/fieldValues';
import type { EditableSpots } from './editableSpots';

/** The value being edited: a field in one block, and for entries the entry clicked. */
export interface EditTarget {
  blockId: string;
  field: FieldKey;
  entry?: number | undefined;
}

/** A commit the note refused because the value changed there since the edit began (§8.6). */
export interface FieldConflict {
  /** What the edit started from and what it wanted; both unset for list and entry changes. */
  base?: FieldValue | undefined;
  mine?: FieldValue | undefined;
  /** Whether "Keep mine" can write the edit again over what the note holds now. */
  canKeepMine: boolean;
}

/** What a value's input needs from the pane: the note's values, where to write, and how to move on. */
export interface PaneEditController {
  app: App;
  notePath: string;
  spots: EditableSpots;
  /** The card's state as the pane reads it: which blocks show a fallback in place of their values. */
  sheet: SheetState;
  editing: EditTarget | null;
  /** False while the note cannot be written (no partner, deleted, broken YAML): inputs keep their text but write nothing. */
  writable: boolean;
  /** The note's values as they are now. */
  record: FieldRecord;
  conflicts: ReadonlyMap<FieldKey, FieldConflict>;
  /** What `field` holds now, through its former keys. */
  read: (field: TemplateField) => FieldRead;
  start: (target: EditTarget) => void;
  /** Leaves editing; `refocus` returns focus to the value's block. */
  stop: (refocus: boolean) => void;
  /** Leaves editing if `blockId` is still the block being edited (focus left it). */
  leave: (blockId: string) => void;
  /** Tab and Shift+Tab: the next or previous value in the template's field order, else out of the card. */
  move: (from: FieldKey, step: 1 | -1) => void;
  /**
   * Writes patches for one field. `mine` is the whole value the edit wants,
   * which "Keep mine" writes again; unset for list and entry changes.
   */
  write: (field: TemplateField, patches: readonly NotePatch[], edit?: { base: FieldValue | undefined; mine: FieldValue | undefined }) => Promise<void>;
  keepMine: (field: TemplateField) => void;
  /** "Use the note's": drops the conflict; the note's value stays. */
  keepNotes: (field: TemplateField) => void;
  /** The focused input's commit, run when the pane closes mid-word. */
  setPending: (commit: () => Promise<void>) => void;
  /** Forgets `commit` unless another input has registered since. */
  releasePending: (commit: () => Promise<void>) => void;
  /** Says something to assistive technology in the pane's live region ("Deleted Bite. Press Ctrl+Z to undo."). */
  announce: (text: string) => void;
}

export const PaneEditContext = createContext<PaneEditController | null>(null);

export function usePaneEdit(): PaneEditController {
  const pane = useContext(PaneEditContext);
  if (!pane) throw new Error('A statblock value input was rendered outside the statblock pane.');
  return pane;
}
