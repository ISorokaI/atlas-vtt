/**
 * Creating a statblock (§7.3), one flow for every entry point: a role of the
 * collection, then the note (`createStatblockNote`) in the role's folder with
 * the role's template, then the note opening with its statblock beside it and
 * focus on the first empty value. From a token the note is named after the token and the token linked;
 * otherwise (commands, the file menu) a popover asks for the name. Behind the
 * `statblockEditor` switch, like every entry point.
 */

import { Notice, type App } from 'obsidian';
import { experimentalFeatureOn } from '../../../experimental/experimentalFeatures';
import { AssetService } from '../../../services/AssetService';
import { createStatblockNote, type NewStatblockNote } from '../../notes/createStatblockNote';
import { roleFolder } from '../../roles/collectionStatblockRoles';
import { openStatblockEditor, type StatblockEditorEntry } from '../openStatblockEditor';
import { chosenRole, roleChoicesFor, roleTemplateId } from './collectionRoles';
import { promptStatblockCreation } from './CreationPrompt';

export interface StatblockCreation {
  /** The entry point's collection; the default collection when null (a map outside every collection, a command). */
  collectionId: string | null;
  roleId: string;
  name: string;
  /** A folder the user picked (the file menu); the role's folder otherwise. */
  folder?: string | undefined;
  /** The token the statblock is for: its art goes into the note, and the token is linked to it. */
  tokenImagePath?: string | undefined;
  from: StatblockEditorEntry;
  /** Called once the token is linked, with the new note's path. */
  onLinked?: ((notePath: string) => void) | undefined;
  /** Values the statblock starts with (Copy into a new statblock). */
  values?: NewStatblockNote['values'];
}

export interface StatblockCreationRequest {
  /** The entry point's collection; null when it named none, and the role menu then offers the collection. */
  collectionId: string | null;
  folder?: string | undefined;
  from: StatblockEditorEntry;
}

/**
 * Creates the note for a chosen role and name, links the token, and opens the
 * note. Returns the note's path, or null when nothing was created (the switch
 * is off, or the note could not be written, which a notice says).
 */
export async function createStatblock(app: App, creation: StatblockCreation): Promise<string | null> {
  if (!experimentalFeatureOn(app, 'statblockEditor')) return null;
  const chosen = chosenRole(app, creation.collectionId, creation.roleId);
  if (!chosen) return null;
  const { collectionId, settings, role } = chosen;

  let notePath: string;
  try {
    const { file, linked } = await createStatblockNote(app, {
      name: creation.name,
      templateId: await roleTemplateId(app, role),
      folder: creation.folder ?? roleFolder(settings, role.id),
      tokenImagePath: creation.tokenImagePath,
      values: creation.values,
    });
    notePath = file.path;
    if (linked) creation.onLinked?.(notePath);
  } catch (error) {
    console.error('[Atlas] Creating a statblock failed:', error);
    new Notice("Couldn't create the statblock.");
    return null;
  }
  await openStatblockEditor(app, { notePath, collectionId, from: creation.from, focusFirstEmpty: true });
  return notePath;
}

/** Where the menu and the popover of a command stand: the top middle of the window, where Obsidian's prompts open. */
function promptPoint(win: Window): { x: number; y: number } {
  return { x: Math.round(win.innerWidth / 2), y: Math.round(win.innerHeight * 0.15) };
}

/**
 * The flow without a token (commands, the file menu): the role menu, with the
 * collection at its top where the entry point named none, then the name
 * popover, then the note. Returns the note's path, or null when
 * the user backed out.
 */
export async function startStatblockCreation(app: App, request: StatblockCreationRequest): Promise<string | null> {
  if (!experimentalFeatureOn(app, 'statblockEditor')) return null;
  const assets = AssetService.getInstance(app);
  const collections = (await assets.getCollections()).map(({ id, name }) => ({ id, name }));
  const requested = request.collectionId;
  const collectionId = requested !== null && collections.some((collection) => collection.id === requested)
    ? requested
    : assets.getDefaultCollectionId();
  const doc = activeDocument;
  const choice = await promptStatblockCreation({
    doc,
    at: promptPoint(doc.win),
    collections,
    collectionId,
    offersCollection: requested === null && collections.length > 1,
    choicesOf: (id) => roleChoicesFor(app, id),
  });
  if (!choice) return null;
  return createStatblock(app, { ...choice, folder: request.folder, from: request.from });
}
