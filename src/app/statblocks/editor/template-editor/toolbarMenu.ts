/** The block toolbar's actions, and the entries of its More… menu (§7.6). */

import type { ContextMenuEntry } from '../../../react/components/context-menu/AtlasContextMenu';
import { AUTHORABLE_BLOCK_TYPES, blockSpec, type AuthorableBlockType } from '../../model/blockCatalogue';
import type { BlockType } from '../../model/templateTypes';
import { shortcutText } from './shortcutText';

export type ToolbarAction =
  | 'move-up' | 'move-down' | 'duplicate' | 'delete'
  | 'side-by-side' | 'group' | 'ungroup' | 'copy' | 'paste'
  | { turnInto: AuthorableBlockType };

export interface ToolbarMenuState {
  /** The selected block's type. */
  blockType: BlockType;
  editable: boolean;
  /** Blocks were copied and can be pasted. */
  canPaste: boolean;
}

/** What a block may turn into: a container into the other container, any other block into another such block. */
export function turnIntoTypes(type: BlockType): AuthorableBlockType[] {
  const container = type === 'section' || type === 'row';
  return AUTHORABLE_BLOCK_TYPES.filter((candidate) =>
    candidate !== type && (candidate === 'section' || candidate === 'row') === container);
}

export function toolbarMenuEntries(state: ToolbarMenuState, act: (action: ToolbarAction) => void): ContextMenuEntry[] {
  const locked = !state.editable;
  const container = state.blockType === 'section' || state.blockType === 'row';
  const turnable = turnIntoTypes(state.blockType);
  return [
    { type: 'item', label: 'Put side by side', icon: 'columns-2', hint: shortcutText(['Mod', 'Alt'], 'R'), disabled: locked, onClick: () => act('side-by-side') },
    { type: 'item', label: 'Group into section', icon: 'square-stack', hint: shortcutText(['Mod'], 'G'), disabled: locked, onClick: () => act('group') },
    { type: 'item', label: 'Ungroup', icon: 'ungroup', hint: shortcutText(['Mod', 'Shift'], 'G'), disabled: locked || !container, onClick: () => act('ungroup') },
    locked || turnable.length === 0
      ? { type: 'item', label: 'Turn into…', icon: 'replace', disabled: true, onClick: () => undefined }
      : {
        type: 'submenu',
        label: 'Turn into…',
        icon: 'replace',
        children: turnable.map((type) => ({ type: 'item' as const, label: blockSpec(type).label, icon: blockSpec(type).icon, onClick: () => act({ turnInto: type }) })),
      },
    { type: 'item', label: 'Copy', icon: 'copy', hint: shortcutText(['Mod'], 'C'), onClick: () => act('copy') },
    { type: 'item', label: 'Paste after', icon: 'clipboard-paste', hint: shortcutText(['Mod'], 'V'), disabled: locked || !state.canPaste, onClick: () => act('paste') },
  ];
}
