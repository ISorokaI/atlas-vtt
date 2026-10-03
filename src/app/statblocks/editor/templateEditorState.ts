/** The template editor's view type and the state Obsidian saves for it in the workspace. */

import { isBuiltInTemplateId, type TemplateId } from '../model/templateTypes';

/** A `FileView` for `.atlastemplate` files; built-ins open in it by id, without a file. */
export const TEMPLATE_EDITOR_VIEW_TYPE = 'atlas-statblock-template';

export interface TemplateEditorState {
  /** A built-in's id. A vault template is named by its file (`state.file`, which `FileView` keeps). */
  templateId: TemplateId | null;
  /** The statblock the canvas shows in place of sample values. */
  previewPath: string | null;
  /** The collection the editor works for (§7.1); null for the default one. */
  collectionId: string | null;
}

/** What `openTemplateEditor` asks of the view once, never saved: the block to select, the built-in a copy came from. */
export interface TemplateEditorEphemeral {
  select?: string | undefined;
  copiedFrom?: TemplateId | undefined;
}

const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';

/** The editor's state from a saved workspace or a `setViewState` call; only a built-in's id is taken from it. */
export function readTemplateEditorState(state: unknown): TemplateEditorState {
  const record = state !== null && typeof state === 'object' ? state as Record<string, unknown> : {};
  const { templateId, previewPath, collectionId } = record;
  return {
    templateId: isText(templateId) && isBuiltInTemplateId(templateId) ? templateId : null,
    previewPath: isText(previewPath) ? previewPath : null,
    collectionId: isText(collectionId) ? collectionId : null,
  };
}

export function readTemplateEditorEphemeral(state: unknown): TemplateEditorEphemeral {
  const record = state !== null && typeof state === 'object' ? state as Record<string, unknown> : {};
  return {
    ...(isText(record.select) && { select: record.select }),
    ...(isText(record.copiedFrom) && { copiedFrom: record.copiedFrom }),
  };
}
