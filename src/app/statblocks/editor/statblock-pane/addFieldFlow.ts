/**
 * Adding a field to a note's template from the pane (D15, §4.7): through the
 * template's session, so an open template editor shows it at once and it is
 * saved like any template edit. A template other statblocks share changes
 * only when the user says so, else the field goes into a copy for this note.
 * A built-in is never changed: the field goes into the collection's own copy
 * of it (spec §9.1), made once, which becomes this note's template.
 */

import type { App } from 'obsidian';
import { ensureOwnCopy } from '../../library/ownCopy';
import { copyTemplate } from '../../library/templateActions';
import { TemplateSession } from '../../library/TemplateSession';
import { templateNotes } from '../../library/templateUsage';
import type { LibraryTemplate } from '../../model/resolvedTypes';
import type { TemplateId } from '../../model/templateTypes';
import { findBlock } from '../../model/treeQueries';
import type { NotePatch } from '../../notes/patchTypes';
import { TEMPLATE_KEY } from '../../notes/statblockSource';
import { toFieldValue } from '../../values/fieldValueOf';
import type { FieldRecord } from '../../values/fieldValues';
import { fieldAddition, type FieldChoice } from './fieldChoices';

/** Where the field goes: the template itself, a copy for this note, or the user is asked first. */
export type AddFieldPlan =
  | { kind: 'template' }
  | { kind: 'copy' }
  | { kind: 'ask'; count: number };

/** The template shared by other statblocks is asked about; a built-in always gets a copy. */
export function addFieldPlan(app: App, entry: LibraryTemplate, notePath: string): AddFieldPlan {
  if (entry.builtIn) return { kind: 'copy' };
  const notes = templateNotes(app, entry.template.id);
  const others = notes.filter((path) => path !== notePath).length;
  return others === 0 ? { kind: 'template' } : { kind: 'ask', count: others + 1 };
}

/** The field as it landed: the template it is in (a copy's when one was made) and its block. */
export interface AddedField {
  templateId: TemplateId;
  /** The template's file; null where it was never found. */
  path: string | null;
  key: string;
  blockId: string;
  /** Whether the template is a copy made for this note, whose `atlas-template` must now name it. */
  copied: boolean;
}

/** Applies the addition in the template's session, as one undo step; null where the session refused it. */
function addThroughSession(app: App, templateId: TemplateId, choice: FieldChoice): Omit<AddedField, 'path' | 'copied'> | null {
  const session = TemplateSession.open(app, templateId);
  if (!session) return null;
  const made: { key: string; blockId: string }[] = [];
  try {
    session.apply((template) => {
      const addition = fieldAddition(template, choice);
      if (addition) made.push({ key: addition.key, blockId: addition.blockId });
      return addition?.template ?? template;
    });
    const added = made.at(-1);
    // A read-only session applies nothing, whatever the edit worked out.
    const landed = added && findBlock(session.getSnapshot().template.layout.blocks, added.blockId);
    return added && landed ? { templateId, ...added } : null;
  } finally {
    // The last holder writes the edit.
    session.release();
  }
}

/** Adds the field to the template every statblock of it shares. */
export function addFieldToTemplate(app: App, entry: LibraryTemplate, choice: FieldChoice): AddedField | null {
  const added = addThroughSession(app, entry.template.id, choice);
  return added && { ...added, path: entry.path, copied: false };
}

/**
 * Adds the field to a copy of the template: a built-in's the collection's own
 * copy (found, or made once), a vault template's a new copy for this note alone.
 */
export async function addFieldToCopy(app: App, entry: LibraryTemplate, choice: FieldChoice, collectionId: string | null): Promise<AddedField | null> {
  const copy = entry.builtIn && collectionId ? await ensureOwnCopy(app, collectionId, entry.template.id) : await copyTemplate(app, entry.template.id);
  const added = addThroughSession(app, copy.id, choice);
  return added && { ...added, path: copy.path, copied: true };
}

/** The patch that makes a note name another template: `atlas-template` alone, no value touched. */
export function templateKeyPatch(record: FieldRecord, templateId: TemplateId): NotePatch {
  return { op: 'set', path: [TEMPLATE_KEY], base: toFieldValue(record[TEMPLATE_KEY]), next: templateId };
}
