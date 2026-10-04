/**
 * The statblock editor's entry points outside the pane (§7.3, §11, D9): the
 * token menu, the asset card, the link dialog, the DM screen and the note
 * fence ask here. While the `statblockEditor` switch is off each answer is
 * "nothing", so every entry point behaves as before.
 */

import type { App, TFile } from 'obsidian';
import { experimentalFeatureOn } from '../../../experimental/experimentalFeatures';
import type { ContextMenuEntry } from '../../../react/components/context-menu/AtlasContextMenu';
import { runInBackground } from '../../../utils/backgroundTask';
import { cachedFrontmatter, frontmatterSource, statblockSourceOf } from '../../notes/statblockSource';
import { openStatblockEditor, type StatblockEditorEntry } from '../openStatblockEditor';
import { roleChoicesFor } from './collectionRoles';
import { createStatblock } from './createFlow';
import { createStatblockMenuEntry } from './RoleMenu';
import type { NewStatblockOption } from './roleChoices';

export interface EntryContext {
  /** The entry point's collection: the asset manager's, the map's; null where there is none. */
  collectionId: string | null;
  from: StatblockEditorEntry;
}

/** The token a statblock is made for: the note takes its name, and its art as `image`. */
export interface TokenForStatblock {
  imagePath: string;
  name: string;
}

export interface TokenCreationContext extends EntryContext {
  token: TokenForStatblock;
  /** Before the note is made, once a role is chosen: close what covers the workspace. */
  onStart?: (() => void) | undefined;
  /** The token was linked to the new note. */
  onLinked?: ((notePath: string) => void) | undefined;
}

/** Whether the frontmatter marks a statblock: a native one, Fantasy Statblocks' or `statblock: inline`. */
export function isMarkedStatblockNote(app: App, path: string): boolean {
  const file = app.vault.getFileByPath(path);
  const frontmatter = file ? cachedFrontmatter(app, file) : undefined;
  return file !== null && (frontmatterSource(frontmatter) !== null || frontmatter?.statblock === 'inline');
}

/** Whether "Edit statblock" opens the pair for the note: a statblock its frontmatter marks, with the switch on (D9). */
export function opensStatblockPair(app: App, path: string): boolean {
  return experimentalFeatureOn(app, 'statblockEditor') && isMarkedStatblockNote(app, path);
}

/** A note whose frontmatter marks nothing may still hold a ```statblock fence: only one with a code block can. */
function mayHoldFence(app: App, file: TFile): boolean {
  return app.metadataCache.getFileCache(file)?.sections?.some((section) => section.type === 'code') ?? false;
}

/** Opens the pair when the note holds a ```statblock fence, else the note as before. */
async function openWhereFenced(app: App, file: TFile, context: EntryContext): Promise<void> {
  if ((await statblockSourceOf(app, file))?.kind === 'fs-fence') {
    await openStatblockEditor(app, { notePath: file.path, collectionId: context.collectionId, from: context.from });
  } else {
    await app.workspace.openLinkText(file.path, '', true);
  }
}

/**
 * "Edit statblock": opens the pair while the switch is on and returns true,
 * for native statblocks and for Fantasy Statblocks' too, which the pane
 * offers to edit with an Atlas template or to copy (§6.4, D9). Returns false
 * for everything else, where the caller opens the note as it always did.
 */
export function editInStatblockPane(app: App, path: string, context: EntryContext): boolean {
  if (opensStatblockPair(app, path)) {
    runInBackground(
      openStatblockEditor(app, { notePath: path, collectionId: context.collectionId, from: context.from }),
      `Opening the statblock of ${path}`,
      "Couldn't open the statblock",
    );
    return true;
  }
  const file = experimentalFeatureOn(app, 'statblockEditor') ? app.vault.getFileByPath(path) : null;
  if (!file || !mayHoldFence(app, file)) return false;
  runInBackground(openWhereFenced(app, file, context), `Opening the statblock of ${path}`, "Couldn't open the statblock");
  return true;
}

function createForToken(app: App, context: TokenCreationContext, roleId: string): void {
  context.onStart?.();
  runInBackground(createStatblock(app, {
    collectionId: context.collectionId,
    roleId,
    name: context.token.name,
    tokenImagePath: context.token.imagePath,
    from: context.from,
    onLinked: context.onLinked,
  }), `Creating a statblock for ${context.token.name}`);
}

/** "Create statblock" for a token without one (token menu, asset card); null while the switch is off. */
export function createStatblockEntry(app: App, context: TokenCreationContext): ContextMenuEntry | null {
  if (!experimentalFeatureOn(app, 'statblockEditor')) return null;
  return createStatblockMenuEntry(roleChoicesFor(app, context.collectionId), (roleId) => createForToken(app, context, roleId));
}

/** The link dialog's "New statblock…" for its token; undefined while the switch is off. */
export function newStatblockOption(app: App, context: TokenCreationContext): NewStatblockOption | undefined {
  if (!experimentalFeatureOn(app, 'statblockEditor')) return undefined;
  return {
    choices: roleChoicesFor(app, context.collectionId),
    onChoose: (roleId) => createForToken(app, context, roleId),
  };
}
