/**
 * The pane's "Create statblock" (§7.2, §7.3) on a note that has none: the note
 * itself becomes a native statblock of the chosen role's template. Its
 * frontmatter gains `statblock: true`, `atlas-template` and, when it has none,
 * `name`, through `NoteFieldWriter`, so it is one undo step in the note.
 */

import { Notice, type App } from 'obsidian';
import { experimentalFeatureOn } from '../../../experimental/experimentalFeatures';
import { runInBackground } from '../../../utils/backgroundTask';
import type { FieldValue, TemplateId } from '../../model/templateTypes';
import { NoteFieldWriter } from '../../notes/NoteFieldWriter';
import type { NotePatch } from '../../notes/patchTypes';
import { TEMPLATE_KEY } from '../../notes/statblockSource';
import type { FrontmatterModel } from '../../notes/yamlDocument';
import type { StatblockPaneActions } from '../statblock-pane/paneTypes';
import { chosenRole, roleTemplateId } from './collectionRoles';

/** The note's own name: its file name without the extension. */
function noteName(path: string): string {
  return (path.split('/').pop() ?? path).replace(/\.md$/i, '');
}

/**
 * The patches that make a note a native statblock, against its frontmatter as
 * the writer reads it. A name the note already has is kept. Throws where the
 * frontmatter cannot be read, which the writer turns into its problem.
 */
export function statblockMarkPatches(frontmatter: FrontmatterModel | null, templateId: TemplateId, name: string): NotePatch[] {
  if (!frontmatter) throw new Error("The note's properties can't be read.");
  const own = (key: string): FieldValue | undefined =>
    (Object.prototype.hasOwnProperty.call(frontmatter, key) ? frontmatter[key] : undefined);
  const set = (key: string, next: FieldValue): NotePatch => ({ op: 'set', path: [key], base: own(key), next });
  return [
    set('statblock', true),
    set(TEMPLATE_KEY, templateId),
    ...(own('name') === undefined ? [set('name', name)] : []),
  ];
}

/** Makes the note at `notePath` a statblock of the role; true when it was written. */
export async function makeNoteAStatblock(app: App, notePath: string, roleId: string, collectionId: string): Promise<boolean> {
  if (!experimentalFeatureOn(app, 'statblockEditor')) return false;
  const chosen = chosenRole(app, collectionId, roleId);
  if (!chosen) return false;
  const templateId = await roleTemplateId(app, chosen.role);
  const outcome = await NoteFieldWriter.forApp(app)
    .patchNow(notePath, (frontmatter) => statblockMarkPatches(frontmatter, templateId, noteName(notePath)));
  if (outcome.applied.length > 0) return true;
  new Notice(outcome.problem ?? "Couldn't make this note a statblock.");
  return false;
}

/** The creation action the plugin hands every statblock pane. */
export function paneCreationActions(app: App): Pick<StatblockPaneActions, 'createStatblock'> {
  return {
    createStatblock: (notePath, roleId, collectionId) => runInBackground(
      makeNoteAStatblock(app, notePath, roleId, collectionId),
      `Making ${notePath} a statblock`,
      "Couldn't make this note a statblock.",
    ),
  };
}
