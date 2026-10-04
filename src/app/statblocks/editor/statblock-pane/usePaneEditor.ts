import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { App } from 'obsidian';
import type { FieldKey, FieldValue, StatblockTemplate, TemplateField } from '../../model/templateTypes';
import type { NotePatch } from '../../notes/patchTypes';
import type { BlockChrome } from '../../render/blockChrome';
import { sheetState } from '../../render/sheetState';
import type { ValueEditing } from '../../render/valueSlot';
import { readField, type FieldRecord } from '../../values/fieldValues';
import type { PaneServices } from '../paneServices';
import { editableSpots, neighbourSpot } from './editableSpots';
import type { EditTarget, FieldConflict, PaneEditController } from './paneEditContext';
import { paneChrome } from './paneChrome';
import { renderPaneSlot } from './PaneSlot';
import type { PendingCommit } from './paneTypes';
import { fieldPatches } from './valuePatches';

export interface PaneEditorOptions {
  app: App;
  services: PaneServices;
  notePath: string;
  template: StatblockTemplate;
  record: FieldRecord;
  writable: boolean;
  pendingCommit: PendingCommit;
  /** The card's element, where focus returns after editing. */
  cardRef: RefObject<HTMLElement | null>;
  /** Tab past the last value, or Shift+Tab before the first. */
  onExit: (step: 1 | -1) => void;
  /** A commit reached the note (the first one dismisses the first-visit hint). */
  onCommitted: () => void;
  /** Why the last write failed, or null once one succeeds. */
  onWriteProblem: (problem: string | null) => void;
  announce: (text: string) => void;
}

export interface PaneEditor {
  controller: PaneEditController;
  chrome: BlockChrome;
  valueEditing: ValueEditing;
}

/** Rendering a value's slot never changes: what it shows comes from the controller's context. */
const VALUE_EDITING: ValueEditing = { slot: renderPaneSlot };

/**
 * The pane's editing state (§7.6, §8.5, §8.6): which value is being edited,
 * the conflicts the note reported, and the writes, each a set of patches
 * whose base is the value the edit started from.
 */
export function usePaneEditor(options: PaneEditorOptions): PaneEditor {
  const { app, services, notePath, template, record, writable, pendingCommit, cardRef } = options;
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [conflicts, setConflicts] = useState<ReadonlyMap<FieldKey, FieldConflict>>(new Map());
  const sheet = useMemo(() => sheetState({ template, record, mode: 'editing' }), [template, record]);
  const spots = useMemo(() => editableSpots(template, sheet), [template, sheet]);
  const latest = useRef({ record, options, conflicts });
  latest.current = { record, options, conflicts };
  const refocus = useRef<string | null>(null);

  useEffect(() => {
    const blockId = refocus.current;
    if (!blockId) return;
    refocus.current = null;
    cardRef.current?.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`)?.focus();
  });

  // A pane that can no longer write (its template is still loading, the note went) leaves no input open.
  useEffect(() => {
    if (!writable) setEditing(null);
  }, [writable]);

  const read = useCallback((field: TemplateField) => readField(latest.current.record, field), []);

  const setConflict = useCallback((key: FieldKey, conflict: FieldConflict | null): void => {
    setConflicts((previous) => {
      if (!conflict && !previous.has(key)) return previous;
      const next = new Map(previous);
      if (conflict) next.set(key, conflict);
      else next.delete(key);
      return next;
    });
  }, []);

  const write = useCallback(async (
    field: TemplateField,
    patches: readonly NotePatch[],
    edit?: { base: FieldValue | undefined; mine: FieldValue | undefined },
  ): Promise<void> => {
    const current = latest.current.options;
    if (!patches.length || !current.writable) return;
    const outcome = await services.writer.write(notePath, patches);
    if (outcome.conflicts.length) setConflict(field.key, { ...edit, canKeepMine: edit !== undefined });
    else setConflict(field.key, null);
    current.onWriteProblem(outcome.problem);
    if (outcome.applied.length) current.onCommitted();
  }, [services, notePath, setConflict]);

  const stop = useCallback((focus: boolean): void => {
    setEditing((target) => {
      if (focus && target) refocus.current = target.blockId;
      return null;
    });
  }, []);

  const controller = useMemo((): PaneEditController => ({
    app,
    notePath,
    spots,
    sheet,
    editing,
    writable,
    record,
    conflicts,
    read,
    start: (target) => { if (latest.current.options.writable) setEditing(target); },
    stop,
    leave: (blockId) => setEditing((target) => (target?.blockId === blockId ? null : target)),
    move: (from, step) => {
      const spot = neighbourSpot(spots.order, from, step);
      if (spot) {
        setEditing({ blockId: spot.blockId, field: spot.field.key });
        return;
      }
      setEditing(null);
      latest.current.options.onExit(step);
    },
    write,
    keepMine: (field) => {
      const conflict = latest.current.conflicts.get(field.key);
      if (!conflict?.canKeepMine) return;
      const now = read(field);
      void write(field, fieldPatches(field.key, now, conflict.mine), { base: now.value, mine: conflict.mine });
    },
    keepNotes: (field) => setConflict(field.key, null),
    setPending: (commit) => { pendingCommit.current = commit; },
    releasePending: (commit) => {
      if (pendingCommit.current === commit) pendingCommit.current = null;
    },
    announce: (text) => latest.current.options.announce(text),
  }), [app, notePath, spots, sheet, editing, writable, record, conflicts, read, stop, write, setConflict, pendingCommit]);

  const chrome = useMemo(() => paneChrome(spots, editing, writable, controller.start), [spots, editing, writable, controller.start]);
  return { controller, chrome, valueEditing: VALUE_EDITING };
}
