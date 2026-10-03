/**
 * What the template gallery makes (§7.9): an editable template in the
 * library, copied from a card, built from a statblock's values or blank; and
 * where it goes next, the template editor or a role of the collection.
 */

import { Notice, type App } from 'obsidian';
import { AssetService } from '../../../services/AssetService';
import { systemPresetsOf } from '../../../services/mapCollectionRules';
import { copyTemplate, createTemplateFile } from '../../library/templateActions';
import type { LibraryTemplate } from '../../model/resolvedTypes';
import type { StatblockTemplate, TemplateId } from '../../model/templateTypes';
import type { FrontmatterRecord } from '../../notes/statblockSource';
import { collectionStatblockRoles, editedStatblockRoles } from '../../roles/collectionStatblockRoles';
import { openTemplateEditor } from '../openTemplateEditor';
import { blankTemplate, firstBlockId } from './gallerySources';
import { noteName } from '../../../utils/pathUtils';
import { statblockTemplate } from './statblockNotes';

/** What the user picked in the gallery. */
export type GalleryPick =
  | { kind: 'template'; entry: LibraryTemplate }
  | { kind: 'statblock'; path: string; template: StatblockTemplate }
  | { kind: 'blank' };

/** A template the gallery made, and what the editor needs to open it. */
export interface CreatedTemplate {
  id: TemplateId;
  path: string;
  /** The block selected when the editor opens; null for a blank template. */
  firstBlock: string | null;
  /** The built-in it was copied from: the editor asks whether what used it moves to the copy (§7.4). */
  copiedFrom: TemplateId | null;
}

const BLANK_NAME = 'New template';

/** Writes the picked template into the library as a template of its own. */
export async function createFromPick(app: App, pick: GalleryPick): Promise<CreatedTemplate> {
  switch (pick.kind) {
    case 'template': {
      const { entry } = pick;
      const created = await copyTemplate(app, entry.template.id, entry.name);
      return { ...created, firstBlock: firstBlockId(entry.template), copiedFrom: entry.builtIn ? entry.template.id : null };
    }
    case 'statblock': {
      const created = await createTemplateFile(app, noteName(pick.path), pick.template);
      return { ...created, firstBlock: firstBlockId(pick.template), copiedFrom: null };
    }
    case 'blank': {
      const created = await createTemplateFile(app, BLANK_NAME, blankTemplate());
      return { ...created, firstBlock: null, copiedFrom: null };
    }
  }
}

/** The role of the collection starts from `templateId`; the collection keeps following its system where that is the system's. */
export async function assignRoleTemplate(app: App, collectionId: string, roleId: string, templateId: TemplateId): Promise<void> {
  const assets = AssetService.getInstance(app);
  const settings = assets.getCollectionSettings(collectionId);
  const presets = systemPresetsOf(app);
  const roles = collectionStatblockRoles(settings, presets).map((role) => (role.id === roleId ? { ...role, templateId } : role));
  const system = presets.find((preset) => preset.id === settings.systemPresetId)?.rules.statblockRoles;
  await assets.updateCollectionSettings(collectionId, { statblockRoles: editedStatblockRoles(roles, system) });
}

/** After the gallery: the role takes the template, and the template editor opens on it with its first block selected. */
export async function openCreatedTemplate(app: App, created: CreatedTemplate, collectionId: string | null, roleId: string | null): Promise<void> {
  if (collectionId !== null && roleId !== null) await assignRoleTemplate(app, collectionId, roleId, created.id);
  await openTemplateEditor(app, {
    templateId: created.id,
    path: created.path,
    collectionId,
    select: created.firstBlock ?? undefined,
    copiedFrom: created.copiedFrom ?? undefined,
  });
}

/**
 * Save as a template (§6.4): a Fantasy Statblocks statblock read without the
 * plugin becomes a template of the library, shaped like its auto template,
 * and opens in the template editor previewing the statblock.
 */
export async function saveStatblockAsTemplate(app: App, notePath: string, values: FrontmatterRecord, collectionId: string | null): Promise<void> {
  const template = statblockTemplate(values);
  if (!template) {
    new Notice('This statblock has no values to build a template from.');
    return;
  }
  try {
    const created = await createTemplateFile(app, noteName(notePath), template);
    await openTemplateEditor(app, {
      templateId: created.id, path: created.path, previewPath: notePath, collectionId, select: firstBlockId(template) ?? undefined,
    });
  } catch (error) {
    console.error('[Atlas] Saving the statblock as a template failed:', error);
    new Notice("Couldn't save the template.");
  }
}
