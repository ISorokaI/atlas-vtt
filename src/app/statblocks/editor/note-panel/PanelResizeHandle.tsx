import React, { useEffect, useRef, useState } from 'react';
import { MIN_PANEL_WIDTH, clampPanelWidth } from './panelPrefs';

export interface PanelResizeHandleProps {
  width: number;
  /** The width of the view's content, which the panel shares with the note. */
  availableWidth: () => number;
  /** A new width while dragging (`done` false) and once let go or set by key. */
  onResize: (width: number, done: boolean) => void;
}

const KEY_STEP = 16;
const KEY_STEP_LARGE = 64;
/** On the body while the edge is dragged: the resize cursor everywhere, and no text selected on the way. */
const RESIZING_CLASS = 'atlas-sb-panel-resizing';

/**
 * The line on the panel's left edge: dragging it or pressing the arrow keys
 * while it has focus sets the panel's width. The panel is on the right, so
 * moving the line left makes it wider.
 */
export function PanelResizeHandle({ width, availableWidth, onResize }: PanelResizeHandleProps): React.JSX.Element {
  const [shown, setShown] = useState(width);
  const stopDrag = useRef<(() => void) | null>(null);
  useEffect(() => setShown(width), [width]);
  useEffect(() => () => stopDrag.current?.(), []);

  const resize = (next: number, done: boolean): void => {
    const clamped = clampPanelWidth(next, availableWidth());
    setShown(clamped);
    onResize(clamped, done);
  };

  // The drag is followed on the handle's window, so it goes on wherever the pointer moves (a popout's too).
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    stopDrag.current?.();
    const win = event.currentTarget.win;
    const { pointerId, clientX: startX } = event;
    const startWidth = shown;
    const widthAt = (x: number): number => startWidth + startX - x;
    const onMove = (move: PointerEvent): void => {
      if (move.pointerId === pointerId) resize(widthAt(move.clientX), false);
    };
    const onUp = (up: PointerEvent): void => {
      if (up.pointerId !== pointerId) return;
      stop();
      resize(widthAt(up.clientX), true);
    };
    // A drag the browser takes away puts the width back.
    const onCancel = (cancel: PointerEvent): void => {
      if (cancel.pointerId !== pointerId) return;
      stop();
      resize(startWidth, true);
    };
    const { body } = win.document;
    const stop = (): void => {
      body.removeClass(RESIZING_CLASS);
      win.removeEventListener('pointermove', onMove);
      win.removeEventListener('pointerup', onUp);
      win.removeEventListener('pointercancel', onCancel);
      stopDrag.current = null;
    };
    body.addClass(RESIZING_CLASS);
    win.addEventListener('pointermove', onMove);
    win.addEventListener('pointerup', onUp);
    win.addEventListener('pointercancel', onCancel);
    stopDrag.current = stop;
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    resize(shown + (event.key === 'ArrowLeft' ? step : -step), true);
  };

  return (
    <div
      className="atlas-sb-note-panel__handle"
      role="separator"
      aria-orientation="vertical"
      aria-label="Statblock width"
      aria-valuenow={shown}
      aria-valuemin={MIN_PANEL_WIDTH}
      aria-valuemax={clampPanelWidth(Number.POSITIVE_INFINITY, availableWidth())}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    />
  );
}
