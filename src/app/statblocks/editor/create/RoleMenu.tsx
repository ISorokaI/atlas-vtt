import React, { useEffect, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { FilePlus } from 'lucide-react';
import { renderEntries, type ContextMenuEntry } from '../../../react/components/context-menu/AtlasContextMenu';
import { Button } from '../../../packages/components/primitives/button';
import { useExclusiveDropdown } from '../../../packages/components/primitives/useExclusiveDropdown';
import { cn } from '../../../../utils/cn';
import type { CollectionChoice } from '../collectionContext';
import type { RoleChoice } from './roleChoices';
import './create-statblock.scss';

export const CREATE_STATBLOCK_LABEL = 'Create statblock';
/** Obsidian's icon for the entries that make a statblock. */
const CREATE_ICON = 'file-plus';

/** The template beside a role's name; none where it would only repeat the name ("Creature", "Creature"). */
function templateHint(choice: RoleChoice): string | null {
  const hint = choice.templateName.trim();
  return hint && hint.toLowerCase() !== choice.name.trim().toLowerCase() ? hint : null;
}

/** The rows of a role menu (§7.3): context-menu geometry, the role's name with its template muted at the row's end. */
export function roleMenuEntries(choices: readonly RoleChoice[], onChoose: (roleId: string) => void): ContextMenuEntry[] {
  return choices.map((choice): ContextMenuEntry => {
    const hint = templateHint(choice);
    return { type: 'item', label: choice.name, ...(hint ? { hint } : {}), onClick: () => onChoose(choice.roleId) };
  });
}

/** "Create statblock" in a context menu: the role menu opens from it, and with one role it creates at once. */
export function createStatblockMenuEntry(choices: readonly RoleChoice[], onChoose: (roleId: string) => void): ContextMenuEntry {
  const [only] = choices;
  if (choices.length === 1 && only) {
    return { type: 'item', label: CREATE_STATBLOCK_LABEL, icon: CREATE_ICON, onClick: () => onChoose(only.roleId) };
  }
  return { type: 'submenu', label: CREATE_STATBLOCK_LABEL, icon: CREATE_ICON, children: roleMenuEntries(choices, onChoose) };
}

/** The menu's collection, at its top: switching it lists the roles of the collection chosen, and the menu stays open. */
function collectionEntry(collections: readonly CollectionChoice[], collectionId: string, onChange: (id: string) => void): ContextMenuEntry {
  const current = collections.find((collection) => collection.id === collectionId);
  return {
    type: 'submenu',
    label: current?.name ?? 'Collection',
    icon: 'library',
    children: collections.map((collection): ContextMenuEntry => ({
      type: 'item',
      label: collection.name,
      checked: collection.id === collectionId,
      keepOpen: true,
      onClick: () => onChange(collection.id),
    })),
  };
}

export interface FloatingRoleMenuProps {
  /** The document the menu shows in: the window the command was given in. */
  doc: Document;
  /** Where the menu hangs from, in the window's coordinates. */
  at: { x: number; y: number };
  collections: readonly CollectionChoice[];
  /** The collection whose roles are listed first. */
  collectionId: string;
  /** Whether the collection can be switched at the menu's top: the entry point named none, and there are several. */
  offersCollection: boolean;
  choicesOf: (collectionId: string) => readonly RoleChoice[];
  onChoose: (roleId: string, collectionId: string) => void;
  /** Closed without a choice: Escape, a click elsewhere. */
  onDismiss: () => void;
}

/**
 * A role menu without a control to open from (commands, the file menu): it
 * opens at a point of the window, and closing it without a choice ends the
 * creation.
 */
export function FloatingRoleMenu(props: FloatingRoleMenuProps): React.JSX.Element {
  const { doc, at, collections, offersCollection, choicesOf, onChoose, onDismiss } = props;
  const [collectionId, setCollectionId] = useState(props.collectionId);
  const entries = [
    ...(offersCollection ? [collectionEntry(collections, collectionId, setCollectionId)] : []),
    ...roleMenuEntries(choicesOf(collectionId), (roleId) => onChoose(roleId, collectionId)),
  ];
  return (
    <DropdownMenu.Root open onOpenChange={(open) => { if (!open) onDismiss(); }}>
      <DropdownMenu.Trigger asChild>
        {/* The menu takes its name from its trigger, which has nothing else to name it with. */}
        <div className="atlas-sb-create-anchor" aria-label="Choose a role" style={{ left: at.x, top: at.y }} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={doc.body}>
        <DropdownMenu.Content
          className="atlas-ctx-menu"
          side="bottom"
          align="center"
          collisionPadding={8}
          // The flow decides where focus goes: into the name popover, or back where it was.
          onCloseAutoFocus={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.stopPropagation()}
        >
          {/* A chosen role closes the menu through Radix, which the flow reads as the choice it already has. */}
          {renderEntries(entries, () => undefined)}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export interface NewStatblockButtonProps {
  choices: readonly RoleChoice[];
  onChoose: (roleId: string) => void;
  /** Told when the role menu opens and closes, so a dialog leaves Escape to it meanwhile. */
  onMenuOpenChange?: ((open: boolean) => void) | undefined;
  className?: string | undefined;
}

/**
 * "New statblock…" in a dialog's footer: the role menu opens from it above
 * the button; with one role the button creates at once.
 */
export function NewStatblockButton({ choices, onChoose, onMenuOpenChange, className }: NewStatblockButtonProps): React.JSX.Element {
  const { isOpen, setIsOpen, onCloseAutoFocus } = useExclusiveDropdown();
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  useEffect(() => { onMenuOpenChange?.(isOpen); }, [isOpen, onMenuOpenChange]);
  const [only] = choices;
  const classes = cn('atlas-sb-new-statblock', className);

  if (choices.length === 1 && only) {
    return (
      <Button type="button" variant="ghost" size="sm" className={classes} onClick={() => onChoose(only.roleId)}>
        <FilePlus aria-hidden />
        New statblock
      </Button>
    );
  }
  return (
    <DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen} modal={false}>
      <DropdownMenu.Trigger asChild>
        <Button ref={setTrigger} type="button" variant="ghost" size="sm" className={classes}>
          <FilePlus aria-hidden />
          New statblock…
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={trigger?.ownerDocument.body}>
        <DropdownMenu.Content
          className="atlas-ctx-menu"
          side="top"
          align="start"
          sideOffset={4}
          collisionPadding={8}
          onCloseAutoFocus={onCloseAutoFocus}
          onEscapeKeyDown={(event) => event.stopPropagation()}
        >
          {renderEntries(roleMenuEntries(choices, onChoose), () => setIsOpen(false))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
