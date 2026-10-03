/**
 * Where a template is used (§8.7): the native statblocks that name it and the
 * collections' roles that start from it. Read from the metadata cache and the
 * loaded asset index; no file is read.
 */

import type { App } from 'obsidian';
import { AssetService } from '../../services/AssetService';
import { systemPresetsOf } from '../../services/mapCollectionRules';
import type { TemplateId } from '../model/templateTypes';
import { cachedFrontmatter, frontmatterSource } from '../notes/statblockSource';
import { collectionStatblockRoles } from '../roles/collectionStatblockRoles';

export interface TemplateUsage {
  /** Paths of the statblock notes that name the template, sorted. */
  notes: readonly string[];
  /** The roles that start from it: each collection's own, or its system's. */
  roles: ReadonlyArray<{ collectionId: string; roleId: string; roleName: string }>;
}

export function templateUsage(app: App, id: TemplateId): TemplateUsage {
  const notes = app.vault.getMarkdownFiles()
    .filter((file) => {
      const source = frontmatterSource(cachedFrontmatter(app, file));
      return source?.kind === 'atlas' && source.templateId === id;
    })
    .map((file) => file.path)
    .sort();
  const presets = systemPresetsOf(app);
  const roles = AssetService.getInstance(app).loadedCollections().flatMap((collection) =>
    collectionStatblockRoles(collection.settings ?? { conditions: [] }, presets)
      .filter((role) => role.templateId === id)
      .map((role) => ({ collectionId: collection.id, roleId: role.id, roleName: role.name })));
  return { notes, roles };
}
