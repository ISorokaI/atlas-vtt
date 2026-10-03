/**
 * Switching notes to another template as one batch (a template replaced on delete, a role's
 * notes moved on): one `atlas-template` patch per note through `NoteFieldWriter`, each note's
 * backend chosen as it is written, with progress and Cancel. A note whose template changed
 * since the list was made keeps it, so a batch cut short or run twice leaves a correct state.
 */

import type { App } from 'obsidian';
import { workSlices } from '../../utils/workSlices';
import type { TemplateId } from '../model/templateTypes';
import { NoteFieldWriter, type WriteOutcome } from './NoteFieldWriter';
import type { NotePatch } from './patchTypes';
import { TEMPLATE_KEY } from './statblockSource';

export interface TemplateSwitchNote {
  path: string;
  /** The template the note was listed with: it switches only while it still names this one. */
  from: TemplateId;
}

export interface TemplateSwitchOptions {
  /** After each note: how many are done of how many. */
  onProgress?: (done: number, total: number) => void;
  /** Cancels the notes not written yet. */
  signal?: AbortSignal;
}

export interface TemplateSwitchResult {
  switched: string[];
  /** Notes left as they were, with why. */
  skipped: Array<{ path: string; reason: string }>;
  /** Notes a cancel kept from being reached; they keep their template. */
  notReached: string[];
}

export async function switchTemplates(
  app: App,
  notes: readonly TemplateSwitchNote[],
  to: TemplateId,
  options: TemplateSwitchOptions = {},
): Promise<TemplateSwitchResult> {
  const writer = NoteFieldWriter.forApp(app);
  const result: TemplateSwitchResult = { switched: [], skipped: [], notReached: [] };
  const pause = workSlices();
  for (const [index, note] of notes.entries()) {
    if (options.signal?.aborted) {
      result.notReached.push(...notes.slice(index).map(({ path }) => path));
      break;
    }
    const patch: NotePatch = { op: 'set', path: [TEMPLATE_KEY], base: note.from, next: to };
    const outcome = await writeAtOnce(writer, note.path, [patch]);
    if (outcome.applied.length > 0) result.switched.push(note.path);
    else result.skipped.push({ path: note.path, reason: skipReason(outcome) });
    options.onProgress?.(index + 1, notes.length);
    await pause();
  }
  return result;
}

/** A batch does not wait out the disk coalescing: each note is written before the next. */
async function writeAtOnce(writer: NoteFieldWriter, path: string, patches: readonly NotePatch[]): Promise<WriteOutcome> {
  const outcome = writer.write(path, patches);
  await writer.flush(path);
  return outcome;
}

function skipReason(outcome: WriteOutcome): string {
  return outcome.problem ?? 'Its template was changed meanwhile.';
}
