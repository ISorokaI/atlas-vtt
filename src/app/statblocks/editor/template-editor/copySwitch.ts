/**
 * After "Make a copy" of a built-in (§7.4): the one question whether the
 * statblocks and the roles of the collection context that use the built-in
 * move to the copy, and the batch that moves them.
 */

import type { App } from 'obsidian';
import { AssetService } from '../../../services/AssetService';
import { systemPresetsOf } from '../../../services/mapCollectionRules';
import { templateUsage } from '../../library/templateUsage';
import type { TemplateId } from '../../model/templateTypes';
import { switchTemplates } from '../../notes/templateSwitch';
import { collectionStatblockRoles, editedStatblockRoles } from '../../roles/collectionStatblockRoles';

export interface CopySwitch {
  from: TemplateId;
  to: TemplateId;
  notes: readonly string[];
  /** The context collection's roles that start from the built-in. */
  roleNames: readonly string[];
  collectionId: string | null;
  collectionName: string | null;
}

function listed(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`;
}

/** "Use the copy for the 12 statblocks and the role Monster of Marsh campaign?"; null when nothing uses the built-in. */
export function copySwitchQuestion(question: Pick<CopySwitch, 'notes' | 'roleNames' | 'collectionName'>): string | null {
  const parts: string[] = [];
  const count = question.notes.length;
  if (count > 0) parts.push(count === 1 ? 'the statblock' : `the ${count} statblocks`);
  if (question.roleNames.length > 0) {
    const roles = `the ${question.roleNames.length === 1 ? 'role' : 'roles'} ${listed(question.roleNames)}`;
    parts.push(question.collectionName ? `${roles} of ${question.collectionName}` : roles);
  }
  return parts.length ? `Use the copy for ${parts.join(' and ')}?` : null;
}

/** What uses the built-in now: every statblock naming it, and the roles of the collection context. */
export function copySwitchFor(app: App, from: TemplateId, to: TemplateId, collectionId: string | null): CopySwitch {
  const usage = templateUsage(app, from);
  const roles = usage.roles.filter((role) => role.collectionId === collectionId);
  const collection = collectionId === null ? undefined : AssetService.getInstance(app).loadedCollections().find((entry) => entry.id === collectionId);
  return { from, to, notes: usage.notes, roleNames: roles.map((role) => role.roleName), collectionId, collectionName: collection?.name ?? null };
}

/** Switch: the statblocks in one batch of `atlas-template` patches, then the collection's roles. */
export async function switchToCopy(app: App, question: CopySwitch): Promise<void> {
  await switchTemplates(app, question.notes.map((path) => ({ path, from: question.from })), question.to);
  if (question.collectionId === null || question.roleNames.length === 0) return;
  const assets = AssetService.getInstance(app);
  const settings = assets.getCollectionSettings(question.collectionId);
  const presets = systemPresetsOf(app);
  const roles = collectionStatblockRoles(settings, presets)
    .map((role) => (role.templateId === question.from ? { ...role, templateId: question.to } : role));
  const system = presets.find((preset) => preset.id === settings.systemPresetId)?.rules.statblockRoles;
  await assets.updateCollectionSettings(question.collectionId, { statblockRoles: editedStatblockRoles(roles, system) });
}
