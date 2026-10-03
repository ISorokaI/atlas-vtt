/**
 * What the template gallery offers (§7.9): its sources, the templates each
 * one lists, and the roles "Use for" may give the new template. Pure.
 */

import { GENERIC_CREATURE, GENERIC_HAZARD, GENERIC_NPC } from '../../presets/generic';
import type { LibraryTemplate } from '../../model/resolvedTypes';
import type { StatblockRole } from '../../model/roleTypes';
import {
  TEMPLATE_FORMAT, TEMPLATE_VERSION, isBuiltInTemplateId, type StatblockTemplate, type TemplateId,
} from '../../model/templateTypes';

export type GallerySourceId = 'system' | 'built-ins' | 'simple' | 'statblock' | 'blank';

export interface GallerySource {
  id: GallerySourceId;
  label: string;
}

/** Atlas' own generic tier, for homebrew and systems without a template of their own. */
const SIMPLE_TEMPLATE_IDS: readonly TemplateId[] = [GENERIC_CREATURE.id, GENERIC_NPC.id, GENERIC_HAZARD.id];

/** The sources in the order the gallery lists them; "This system" only where the system names templates. */
export function gallerySources(systemTemplateIds: readonly TemplateId[]): GallerySource[] {
  return [
    ...(systemTemplateIds.length > 0 ? [{ id: 'system' as const, label: 'This system' }] : []),
    { id: 'built-ins', label: 'All built-ins' },
    { id: 'simple', label: 'Simple' },
    { id: 'statblock', label: 'From a statblock' },
    { id: 'blank', label: 'Blank' },
  ];
}

/** The templates the roles of a game system start from, each once, in the roles' order. */
export function systemTemplateIds(roles: readonly StatblockRole[] | undefined): TemplateId[] {
  return [...new Set((roles ?? []).map((role) => role.templateId))];
}

type Lookup = (id: TemplateId) => LibraryTemplate | null;

/** The templates a source shows as cards; none for the sources that are no list of templates. */
export function sourceTemplates(
  source: GallerySourceId, builtIns: readonly LibraryTemplate[], systemIds: readonly TemplateId[], lookup: Lookup,
): LibraryTemplate[] {
  const found = (ids: readonly TemplateId[]): LibraryTemplate[] => [...new Set(ids)].map(lookup).filter((entry): entry is LibraryTemplate => entry !== null);
  switch (source) {
    case 'system': return found(systemIds);
    case 'built-ins': return [...builtIns];
    case 'simple': return found(SIMPLE_TEMPLATE_IDS);
    case 'statblock': case 'blank': return [];
  }
}

/** The source the gallery opens on: the system's templates where there are any. */
export function firstSource(sources: readonly GallerySource[]): GallerySourceId {
  return sources[0]?.id ?? 'built-ins';
}

/** "SRD 5.2.1 · CC BY 4.0" for licensed built-ins; null for Atlas' own templates. */
export function sourceLine(template: StatblockTemplate): string | null {
  return template.source?.label ?? null;
}

/**
 * The roles "Use for" offers: those without a template of their own, which
 * start from a built-in or from a template the vault no longer holds.
 */
export function rolesWithoutOwnTemplate(roles: readonly StatblockRole[], inVault: (id: TemplateId) => boolean): StatblockRole[] {
  return roles.filter((role) => isBuiltInTemplateId(role.templateId) || !inVault(role.templateId));
}

/** The role "Use for" starts on: the one that starts from the chosen template; none otherwise. */
export function roleFor(candidates: readonly StatblockRole[], templateId: TemplateId | null): string | null {
  return candidates.find((role) => role.templateId === templateId)?.id ?? null;
}

/** A template without blocks: the editor shows its ghost card (§7.9). */
export function blankTemplate(): StatblockTemplate {
  return { format: TEMPLATE_FORMAT, version: TEMPLATE_VERSION, id: 'blank', fields: [], layout: { maxColumns: 2, blocks: [] } };
}

/** The block the editor selects when a new template opens. */
export function firstBlockId(template: StatblockTemplate): string | null {
  return template.layout.blocks[0]?.id ?? null;
}
