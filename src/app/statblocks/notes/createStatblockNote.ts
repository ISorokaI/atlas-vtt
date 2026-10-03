/**
 * Creating a native statblock note (§7.3): `statblock: true`, its template, its name and, for a
 * token, the token's art; the read-only note fence at the top of the body while the setting
 * "Show statblocks in their notes" is on (D14); then the token linked to it.
 */

import { normalizePath, type App, type TFile, type TFolder } from 'obsidian';
import { ensureFolder } from '../../plugin/vaultFolders';
import { SettingsService } from '../../services/SettingsService';
import { TokenStatblockLinkService } from '../../services/TokenStatblockLinkService';
import { INVALID_NAME_CHARACTERS } from '../../services/assetPaths';
import type { TemplateId } from '../model/templateTypes';
import { applyFrontmatterPatches } from './frontmatterPatch';
import type { NotePatch } from './patchTypes';
import { STATBLOCK_FENCE_LANGUAGE, TEMPLATE_KEY } from './statblockSource';

export interface NewStatblockNote {
  name: string;
  templateId: TemplateId;
  /** Vault folder for the note (the role's folder); Obsidian's folder for new notes when absent. */
  folder?: string | undefined;
  /** The token the statblock is for: its art becomes the note's `image`, and the token is linked to the note. */
  tokenImagePath?: string | undefined;
}

export interface CreatedStatblockNote {
  file: TFile;
  /** Whether the token was linked; false without a token. */
  linked: boolean;
}

const FALLBACK_NAME = 'New statblock';

/** Creates the note and links the token to it. Throws when the note cannot be created. */
export async function createStatblockNote(app: App, note: NewStatblockNote): Promise<CreatedStatblockNote> {
  const folder = await targetFolder(app, note.folder);
  const path = freeNotePath(app, folder, noteFileName(note.name));
  const withFence = SettingsService.forApp(app)?.getSetting('showStatblocksInNotes') ?? true;
  const file = await app.vault.create(path, statblockNoteText(note, withFence));
  const linked = note.tokenImagePath === undefined
    ? false
    : await TokenStatblockLinkService.getInstance(app).linkTokenToStatblock(note.tokenImagePath, file.path, { showConfirmation: false });
  return { file, linked };
}

/** The folder named, created when missing, or Obsidian's folder for new notes. */
async function targetFolder(app: App, folder: string | undefined): Promise<TFolder> {
  if (folder === undefined) return app.fileManager.getNewFileParent('');
  const path = normalizePath(folder);
  return isRootPath(path) ? app.vault.getRoot() : ensureFolder(app, path);
}

/** The text of a new statblock note: its frontmatter, written by the patcher, and the note fence when asked for. */
export function statblockNoteText(note: Pick<NewStatblockNote, 'name' | 'templateId' | 'tokenImagePath'>, withFence: boolean): string {
  const set = (key: string, next: string | boolean): NotePatch => ({ op: 'set', path: [key], base: undefined, next });
  const patches = [
    set('statblock', true),
    set(TEMPLATE_KEY, note.templateId),
    set('name', note.name.trim() || FALLBACK_NAME),
    ...(note.tokenImagePath ? [set('image', note.tokenImagePath)] : []),
  ];
  const body = withFence ? `\`\`\`${STATBLOCK_FENCE_LANGUAGE}\n\`\`\`\n` : '';
  const result = applyFrontmatterPatches(body, patches);
  if (result.conflicts.length > 0) throw new Error('The statblock note could not be written.');
  return result.text;
}

/** A note name a file can carry: characters Obsidian rejects or that break links become `-`. */
export function noteFileName(name: string): string {
  const cleaned = name.trim().replace(new RegExp(INVALID_NAME_CHARACTERS.source, 'g'), '-').replace(/^\.+/, '').trim();
  return cleaned || FALLBACK_NAME;
}

/**
 * `<name>.md` in the folder, else `<name> 2.md`, `<name> 3.md`… Taken counts any letter case,
 * since the file systems of macOS and Windows do not tell names apart by it.
 */
export function freeNotePath(app: App, folder: TFolder, stem: string): string {
  const taken = new Set(folder.children.map((child) => child.name.toLowerCase()));
  const pathOf = (name: string): string => normalizePath(isRootPath(folder.path) ? name : `${folder.path}/${name}`);
  let name = `${stem}.md`;
  for (let n = 2; taken.has(name.toLowerCase()) || app.vault.getAbstractFileByPath(pathOf(name)); n++) name = `${stem} ${n}.md`;
  return pathOf(name);
}

function isRootPath(path: string): boolean {
  return path === '/' || path === '';
}
