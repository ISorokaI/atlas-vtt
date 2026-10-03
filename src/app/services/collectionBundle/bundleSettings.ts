import { BUILT_IN_SYSTEM_PRESETS } from '../../gameSystems/builtInPresets';
import { legacyCollectionResources } from '../../resources/collectionResources';
import { sameResourceDefinitions } from '../../resources/resourceDefinitions';
import { collectionStatblockRoles, sameStatblockRoles } from '../../statblocks/roles/collectionStatblockRoles';
import type { CollectionSettings } from '../../types/collectionSettingsTypes';
import type { SystemPreset } from '../../types/systemPresetTypes';

/**
 * A collection's settings as bundles compare them. Resources that only restate what the
 * settings read as before resources were stored are left out: Atlas stores them by itself
 * (`storeLegacyResources`), which is no edit of the GM's. Nor is what players see. Roles equal
 * to those the settings read from their preset (`presets`, the generic pair without one) are
 * left out too: a bundle writes out a user preset's roles (`withPresetRoles`), which the
 * collection it was made from reads unset.
 */
export function comparableSettings(
  settings: CollectionSettings | undefined,
  presets: readonly SystemPreset[] = BUILT_IN_SYSTEM_PRESETS,
): Partial<CollectionSettings> | undefined {
  if (!settings) return settings;
  const { resources, statblockRoles, ...rest } = settings;
  const ownResources = resources !== undefined
    && !sameResourceDefinitions(resources, legacyCollectionResources(rest, BUILT_IN_SYSTEM_PRESETS));
  // An empty list is none: the collection reads its preset's
  const ownRoles = !!statblockRoles?.length
    && !sameStatblockRoles(statblockRoles, collectionStatblockRoles({ systemPresetId: rest.systemPresetId }, presets));
  return { ...rest, ...(ownResources && { resources }), ...(ownRoles && { statblockRoles }) };
}

/** `settings` with each loot base at the path `pathOf` gives it; a base without one is left out. */
export function withLootBases(settings: CollectionSettings, pathOf: (path: string) => string | undefined): CollectionSettings {
  const { lootBases } = settings;
  return lootBases ? { ...settings, lootBases: lootBases.flatMap((path) => pathOf(path) ?? []) } : settings;
}

/**
 * `settings` with each role's folder at the folder `folderOf` gives it; a folder without one
 * is left out, so new statblocks of that role go to Obsidian's location for new notes.
 */
export function withRoleFolders(settings: CollectionSettings, folderOf: (folder: string) => string | undefined): CollectionSettings {
  const folders = settings.statblockRoleFolders;
  if (!folders) return settings;
  const moved = Object.entries(folders).flatMap(([roleId, folder]): Array<[string, string]> => {
    const target = folderOf(folder);
    return target ? [[roleId, target]] : [];
  });
  const { statblockRoleFolders: _folders, ...rest } = settings;
  return moved.length > 0 ? { ...rest, statblockRoleFolders: Object.fromEntries(moved) } : rest;
}

/**
 * The settings a bundle carries: roles the collection reads from a user preset written out,
 * since the recipient may not have that preset (its `systemPresetId` then names nothing). A
 * built-in preset's roles stay unset: every Atlas has them.
 */
export function withPresetRoles(settings: CollectionSettings, presets: readonly SystemPreset[]): CollectionSettings {
  if (settings.statblockRoles?.length) return settings;
  const preset = presets.find((candidate) => candidate.id === settings.systemPresetId);
  const roles = preset?.rules.statblockRoles;
  return preset && !preset.builtIn && roles?.length ? { ...settings, statblockRoles: structuredClone(roles) } : settings;
}

/** The settings an import takes from a bundle. One written by an older Atlas names no resources: the vault keeps its own. */
export function settingsFromBundle(theirs: CollectionSettings, mine: CollectionSettings | undefined): CollectionSettings {
  return theirs.resources || !mine?.resources ? theirs : { ...theirs, resources: mine.resources };
}
