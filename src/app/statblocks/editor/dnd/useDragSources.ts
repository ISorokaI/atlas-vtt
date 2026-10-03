/**
 * The places a drag starts (§7.6): a block of the canvas (pressed anywhere on
 * it, or picked up with Space while it has focus), the block toolbar's
 * handle, a palette tile and a field of the Fields tab. Each is a dnd-kit
 * draggable; outside `TemplateDragAndDrop` they do nothing, so the parts
 * still render in a test without it.
 */

import { useMemo, useState, type DOMAttributes, type KeyboardEvent, type PointerEvent } from 'react';
import { useDraggable, type DraggableSyntheticListeners } from '@dnd-kit/core';
import type { TemplateField } from '../../model/templateTypes';
import { blockFrame, frameAt } from '../template-editor/editorChrome';
import { itemKey, type InsertItem } from '../template-editor/insertItems';
import type { DragData } from './dragSources';

type Handlers = Pick<DOMAttributes<HTMLElement>, 'onPointerDown' | 'onKeyDown'>;
type Handler<E> = (event: E) => void;

/** Picks up the press: a drag of the canvas's blocks never starts on its chrome (labels, tags, the `+` line). */
const CHROME = '.atlas-te-chrome';
const SHEET = '.atlas-statblock';

function listener<E>(listeners: DraggableSyntheticListeners, name: 'onPointerDown' | 'onKeyDown'): Handler<E> | undefined {
  const found = listeners?.[name];
  return typeof found === 'function' ? (found as Handler<E>) : undefined;
}

/**
 * The canvas's blocks: one draggable that takes the block pressed (or
 * focused) when the press comes, so 150 blocks need no 150 registrations and
 * the card's renderer stays free of dnd-kit.
 */
export function useCanvasDrag(stageRef: { readonly current: HTMLElement | null }, enabled: boolean): Handlers {
  const [data] = useState<DragData>(() => ({ source: null }));
  const { listeners, setNodeRef, setActivatorNodeRef } = useDraggable({ id: 'atlas-te-canvas-block', data, disabled: !enabled });

  const arm = (target: EventTarget | null): boolean => {
    const element = target as Element | null;
    const sheet = stageRef.current?.querySelector<HTMLElement>(SHEET);
    if (!sheet || typeof element?.closest !== 'function' || element.closest(CHROME)) return false;
    const frame = frameAt(element, sheet);
    const id = frame?.getAttribute('data-block-id');
    if (!frame || !id) return false;
    data.source = { kind: 'block', id };
    setNodeRef(frame);
    setActivatorNodeRef(frame);
    return true;
  };

  return {
    onPointerDown: (event) => {
      if (arm(event.target)) listener<PointerEvent>(listeners, 'onPointerDown')?.(event);
    },
    onKeyDown: (event) => {
      const target = event.target as Element;
      if (typeof target.hasAttribute === 'function' && target.hasAttribute('data-block-id') && arm(target)) {
        listener<KeyboardEvent>(listeners, 'onKeyDown')?.(event);
      }
    },
  };
}

/** The block toolbar's handle: drags the block it hangs from; Space or Enter on it picks the block up. */
export function useHandleDrag(stage: HTMLElement, blockId: string, enabled: boolean): Handlers {
  const [data] = useState<DragData>(() => ({ source: null }));
  const { listeners, setNodeRef, setActivatorNodeRef } = useDraggable({ id: 'atlas-te-block-handle', data, disabled: !enabled });

  const arm = (target: EventTarget | null): boolean => {
    const frame = blockFrame(stage, blockId);
    const button = typeof (target as Element | null)?.closest === 'function' ? (target as Element).closest('button') : null;
    if (!frame || !button) return false;
    data.source = { kind: 'block', id: blockId };
    setNodeRef(frame);
    setActivatorNodeRef(button);
    return true;
  };

  return {
    onPointerDown: (event) => {
      if (arm(event.target)) listener<PointerEvent>(listeners, 'onPointerDown')?.(event);
    },
    onKeyDown: (event) => {
      if (arm(event.target)) listener<KeyboardEvent>(listeners, 'onKeyDown')?.(event);
    },
  };
}

export interface PointerDragProps {
  ref: (element: HTMLElement | null) => void;
  onPointerDown?: Handler<PointerEvent> | undefined;
}

/** A palette tile dragged onto the canvas inserts its block there; the keyboard inserts with Enter as before. */
export function usePaletteDrag(item: InsertItem, disabled: boolean): PointerDragProps {
  const data = useMemo<DragData>(() => ({ source: { kind: 'item', item } }), [item]);
  const { listeners, setNodeRef } = useDraggable({ id: `atlas-te-item:${itemKey(item)}`, data, disabled });
  return { ref: setNodeRef, onPointerDown: listener(listeners, 'onPointerDown') };
}

/** A field dragged onto the canvas gets the natural block for its type, bound to it. */
export function useFieldDrag(field: TemplateField, disabled: boolean): PointerDragProps {
  const data = useMemo<DragData>(() => ({ source: { kind: 'field', key: field.key } }), [field.key]);
  const { listeners, setNodeRef } = useDraggable({ id: `atlas-te-field:${field.key}`, data, disabled });
  return { ref: setNodeRef, onPointerDown: listener(listeners, 'onPointerDown') };
}
