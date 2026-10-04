/**
 * What a target's menu offers, as descriptors (spec §5.1): one builder per
 * target kind returns them, and every way into the menu (right-click, the
 * handle, the toolbar's More, Shift+F10) renders the same list through
 * Atlas' context menu. Destructive rows come last; a row with a key shows it.
 */

import React from 'react';
import type { ContextMenuEntry } from '../../../react/components/context-menu/AtlasContextMenu';

/** At most this many rows in one menu; a submenu counts on its own (J11). */
export const MAX_MENU_ROWS = 12;

export type SurfaceAction =
  | {
    kind: 'item';
    id: string;
    label: string;
    icon?: string | undefined;
    /** The key that does the same, written as the platform writes it. */
    hint?: string | undefined;
    disabled?: boolean | undefined;
    destructive?: boolean | undefined;
    /** A choice among several: ticked while it is the one in use. */
    checked?: boolean | undefined;
    run: () => unknown;
  }
  | { kind: 'submenu'; id: string; label: string; icon?: string | undefined; children: SurfaceAction[] }
  | { kind: 'separator' };

export type SurfaceItem = Extract<SurfaceAction, { kind: 'item' }>;

export const SEPARATOR: SurfaceAction = { kind: 'separator' };

function separatorRow(): React.ReactNode {
  return React.createElement('div', { className: 'atlas-ctx-separator', role: 'separator' });
}

/**
 * Drops separators that would stand first, last or twice in a row, and empty
 * submenus, so a builder may add sections freely.
 */
export function tidy(actions: readonly SurfaceAction[]): SurfaceAction[] {
  const out: SurfaceAction[] = [];
  for (const action of actions) {
    if (action.kind === 'submenu' && action.children.length === 0) continue;
    if (action.kind === 'separator' && (out.length === 0 || out.at(-1)?.kind === 'separator')) continue;
    out.push(action.kind === 'submenu' ? { ...action, children: tidy(action.children) } : action);
  }
  if (out.at(-1)?.kind === 'separator') out.pop();
  return out;
}

/** The rows a menu shows, separators left out; a submenu is one row here. */
export function rowCount(actions: readonly SurfaceAction[]): number {
  return actions.filter((action) => action.kind !== 'separator').length;
}

/** Every menu in a tree of actions holds at most `MAX_MENU_ROWS` rows. */
export function fitsMenuLimit(actions: readonly SurfaceAction[]): boolean {
  return rowCount(actions) <= MAX_MENU_ROWS
    && actions.every((action) => action.kind !== 'submenu' || fitsMenuLimit(action.children));
}

/** The descriptors as Atlas' context menu draws them. */
export function toMenuEntries(actions: readonly SurfaceAction[]): ContextMenuEntry[] {
  return tidy(actions).map((action): ContextMenuEntry => {
    switch (action.kind) {
      case 'separator': return { type: 'custom', render: separatorRow };
      case 'submenu': return { type: 'submenu', label: action.label, ...(action.icon && { icon: action.icon }), children: toMenuEntries(action.children) };
      case 'item': return {
        type: 'item',
        label: action.label,
        onClick: action.run,
        ...(action.icon && { icon: action.icon }),
        ...(action.hint && { hint: action.hint }),
        ...(action.disabled !== undefined && { disabled: action.disabled }),
        ...(action.destructive && { destructive: true }),
        ...(action.checked !== undefined && { checked: action.checked }),
      };
    }
  });
}

/** The first item with this id, anywhere in the tree (tests, and keys that run a menu's action). */
export function findAction(actions: readonly SurfaceAction[], id: string): SurfaceItem | null {
  for (const action of actions) {
    if (action.kind === 'item' && action.id === id) return action;
    if (action.kind === 'submenu') {
      const found = findAction(action.children, id);
      if (found) return found;
    }
  }
  return null;
}
