import { useMemo } from 'react';
import type { App } from 'obsidian';
import type { ContextMenuEntry } from '../../../react/components/context-menu/AtlasContextMenu';
import { useBestiaryRevision } from '../../../react/hooks/useBestiaryRevision';
import { runInBackground } from '../../../utils/backgroundTask';
import { findImportedTemplate, identityOf, importFsLayout } from '../../fs/fsImport';
import { noteFsLayout, noteLayout } from '../../fs/fsLayoutNotes';
import type { FsLayout } from '../../fs/fsLayoutTypes';
import { useTemplateLibrary } from '../../library/useTemplateLibrary';
import type { TemplateId } from '../../model/templateTypes';
import type { FrontmatterRecord } from '../../notes/statblockSource';
import { chosenRole, roleChoicesFor, roleTemplateId } from '../create/collectionRoles';
import { roleMenuEntries } from '../create/RoleMenu';
import { showImportOutcome } from '../fs-import/layoutImportFlow';
import type { PaneServices } from '../paneServices';
import { templateKeyPatch } from './addFieldFlow';
import { copyFenceIntoStatblock } from './fenceCopy';

export interface FsAdoptionInput {
  app: App;
  notePath: string;
  record: FrontmatterRecord;
  collectionId: string | null;
  writer: PaneServices['writer'];
  /** Why the note could not take the template, or null once it did. */
  onWriteProblem: (problem: string | null) => void;
  /** The document dialogs open in: the pane's window. */
  doc: () => Document;
}

const FAILED = "Couldn't change the statblock.";

/**
 * "Edit with an Atlas template" for a statblock of Fantasy Statblocks (§6.4):
 * the template imported from the note's own layout first (imported now when
 * it never was, which then shows the report and the batch for the layout's
 * other notes), then the roles' templates. Choosing writes `atlas-template`
 * alone; `layout:` and every value stay.
 */
export function useFsAdoption(input: FsAdoptionInput): ContextMenuEntry[] {
  const { app, notePath, record, collectionId, writer, onWriteProblem, doc } = input;
  const library = useTemplateLibrary(app);
  // The layouts are Fantasy Statblocks', which may load after the pane.
  const bestiary = useBestiaryRevision(app);
  return useMemo(() => {
    const adopt = async (templateId: TemplateId): Promise<void> => {
      const outcome = await writer.write(notePath, [templateKeyPatch(record, templateId)]);
      onWriteProblem(outcome.conflicts.length ? 'the note\'s template changed meanwhile.' : outcome.problem);
    };
    const importAndAdopt = async (layout: FsLayout): Promise<void> => {
      const imported = await importFsLayout(app, layout);
      await adopt(imported.id);
      showImportOutcome(app, doc(), identityOf(layout), imported, { collectionId, offerOpen: true, except: notePath });
    };
    const adoptRole = async (roleId: string): Promise<void> => {
      const chosen = chosenRole(app, collectionId, roleId);
      if (chosen) await adopt(await roleTemplateId(app, chosen.role));
    };
    const run = (task: Promise<void>): void => runInBackground(task, `Giving ${notePath} an Atlas template`, FAILED);

    const layout = noteLayout(app, record);
    const imported = layout && library ? findImportedTemplate(library.templates, layout) : null;
    const fsLayout = imported ? null : noteFsLayout(app, record);
    const entries: ContextMenuEntry[] = [];
    if (imported) {
      entries.push({ type: 'item', label: imported.name, hint: 'From its layout', onClick: () => run(adopt(imported.template.id)) });
    } else if (fsLayout) {
      entries.push({ type: 'item', label: fsLayout.name, hint: 'Imports its layout', onClick: () => run(importAndAdopt(fsLayout)) });
    }
    return [...entries, ...roleMenuEntries(roleChoicesFor(app, collectionId), (roleId) => run(adoptRole(roleId)))];
  }, [app, notePath, record, collectionId, writer, onWriteProblem, doc, library, bestiary]);
}

/** "Copy into a new statblock" for a fence (§6.4): one entry per role; the new note opens with its pane. */
export function useFenceCopy(app: App, notePath: string, collectionId: string | null): ContextMenuEntry[] {
  // The role choices name the library's templates, so they follow it.
  const library = useTemplateLibrary(app);
  return useMemo(() => roleMenuEntries(roleChoicesFor(app, collectionId), (roleId) => {
    runInBackground(copyFenceIntoStatblock(app, notePath, collectionId, roleId), `Copying the statblock of ${notePath}`, "Couldn't copy the statblock.");
  }), [app, notePath, collectionId, library]);
}
