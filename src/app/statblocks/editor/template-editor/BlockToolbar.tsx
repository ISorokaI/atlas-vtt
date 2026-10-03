import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ArrowDown, ArrowUp, CopyPlus, Ellipsis, GripVertical, Trash2 } from 'lucide-react';
import { ToolButton } from '../../../packages/components/primitives/ToolButton';
import { useKeepInView } from '../../../packages/components/primitives/useKeepInView';
import { renderEntries } from '../../../react/components/context-menu/AtlasContextMenu';
import { observeResize } from '../../../utils/observeResize';
import { cn } from '../../../../utils/cn';
import { useHandleDrag } from '../dnd/useDragSources';
import { blockFrame } from './editorChrome';
import type { ChromeStyle } from './LabelEditor';
import { placeToolbar, type ToolbarPlacement } from './toolbarPlacement';
import { toolbarMenuEntries, type ToolbarAction, type ToolbarMenuState } from './toolbarMenu';
import { shortcutText } from './shortcutText';

export interface BlockToolbarProps extends ToolbarMenuState {
  /** The layer the toolbar is drawn in, over the whole editor. */
  layer: HTMLElement;
  /** The canvas stage holding the card, and the scroller around it. */
  stage: HTMLElement;
  blockId: string;
  /** Whatever changes the block's place: re-measured when it changes. */
  revision: unknown;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onAction: (action: ToolbarAction) => void;
}

const HIDDEN: ToolbarPlacement = { left: 0, top: 0, below: false, hidden: true };

function measure(stage: HTMLElement, layer: HTMLElement, blockId: string, toolbar: HTMLElement | null): ToolbarPlacement {
  const frame = blockFrame(stage, blockId);
  const view = stage.closest('.atlas-te-canvas__scroller') ?? stage;
  if (!frame || !toolbar) return HIDDEN;
  return placeToolbar(frame.getBoundingClientRect(), view.getBoundingClientRect(), layer.getBoundingClientRect(), {
    width: toolbar.offsetWidth,
    height: toolbar.offsetHeight,
  });
}

/**
 * The selected block's toolbar (§7.6): a capsule over the block, or under it
 * where there is no room, in a layer over the editor, kept in its view. Drag
 * handle, Move up, Move down, Duplicate, Delete, and More… with the rest.
 */
export function BlockToolbar(props: BlockToolbarProps): React.JSX.Element {
  const { layer, stage, blockId, revision, editable, menuOpen, onMenuOpenChange, onAction } = props;
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<ToolbarPlacement>(HIDDEN);
  const keepInView = useKeepInView(ref, !placement.hidden, placement.below ? 'bottom' : 'top', `${placement.left},${placement.top}`);
  const handle = useHandleDrag(stage, blockId, editable);

  useLayoutEffect(() => {
    const update = (): void => setPlacement(measure(stage, layer, blockId, ref.current));
    update();
    const scroller = stage.closest('.atlas-te-canvas__scroller');
    scroller?.addEventListener('scroll', update, { passive: true });
    const stop = observeResize([stage, layer], update);
    return () => {
      scroller?.removeEventListener('scroll', update);
      stop();
    };
  }, [stage, layer, blockId, revision]);

  const style: React.CSSProperties & ChromeStyle = {
    ...keepInView.style,
    '--atlas-te-toolbar-x': `${placement.left}px`,
    '--atlas-te-toolbar-y': `${placement.top}px`,
  };
  const button = (icon: React.ComponentType<{ className?: string }>, label: string, action: ToolbarAction, shortcut?: string): React.JSX.Element => (
    <ToolButton icon={icon} label={label} {...(shortcut !== undefined && { shortcut })} isActive={false} disabled={!editable} onClick={() => onAction(action)} />
  );

  return createPortal(
    <div
      ref={ref}
      className={cn('atlas-te-toolbar', keepInView.capped && 'atlas-keep-in-view--capped')}
      role="toolbar"
      aria-label="Block"
      style={style}
      data-hidden={placement.hidden || undefined}
      data-below={placement.below || undefined}
    >
      {/* Drags the block; Space or Enter on it picks the block up for the arrow keys. */}
      <span className="atlas-te-toolbar__handle" data-te-drag-handle="" onPointerDown={handle.onPointerDown} onKeyDown={handle.onKeyDown}>
        <ToolButton icon={GripVertical} label="Drag to move" isActive={false} disabled={!editable} onClick={() => undefined} />
      </span>
      {button(ArrowUp, 'Move up', 'move-up', shortcutText(['Alt'], '↑'))}
      {button(ArrowDown, 'Move down', 'move-down', shortcutText(['Alt'], '↓'))}
      {button(CopyPlus, 'Duplicate', 'duplicate', shortcutText(['Mod'], 'D'))}
      {button(Trash2, 'Delete', 'delete', 'Delete')}
      <DropdownMenu.Root open={menuOpen} onOpenChange={onMenuOpenChange} modal={false}>
        <DropdownMenu.Trigger asChild>
          <span className="atlas-te-toolbar__more">
            <ToolButton icon={Ellipsis} label="More" isActive={false} menuExpanded={menuOpen} onClick={() => undefined} />
          </span>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal container={layer}>
          <DropdownMenu.Content
            className="atlas-ctx-menu atlas-te-toolbar-menu"
            side={placement.below ? 'bottom' : 'top'}
            align="end"
            sideOffset={4}
            collisionPadding={8}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              blockFrame(stage, blockId)?.focus({ preventScroll: true });
            }}
            onEscapeKeyDown={(event) => event.stopPropagation()}
          >
            {renderEntries(toolbarMenuEntries(props, onAction), () => onMenuOpenChange(false))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>,
    layer,
  );
}
