/**
 * How the statblock beside a note is shown on this device: its width and
 * whether it is hidden. Stored with `app.saveLocalStorage` (per vault and
 * device, never synced), since what fits depends on the screen.
 */

import type { App } from 'obsidian';

/** The width a panel starts with, in CSS pixels. */
export const DEFAULT_PANEL_WIDTH = 440;
/** The narrowest panel; the card's columns need about this much. */
export const MIN_PANEL_WIDTH = 300;
/** What the note keeps beside the panel at least; the stylesheet's clamp says the same (`$note-min-width`). */
export const NOTE_MIN_WIDTH = 360;
/** Below this width of the view the panel stands above the note instead of beside it. */
export const STACK_BELOW = 720;

const STORAGE_KEY = 'atlas-vtt-statblock-panel';

export interface PanelPrefs {
  width: number;
  hidden: boolean;
}

/** The width a panel may take in a view of `available` pixels: at least the minimum, leaving the note its room. */
export function clampPanelWidth(width: number, available: number): number {
  const max = Math.max(MIN_PANEL_WIDTH, available - NOTE_MIN_WIDTH);
  return Math.round(Math.min(Math.max(width, MIN_PANEL_WIDTH), max));
}

/** The stored choices; the defaults for anything missing or not a value this version reads. */
export function loadPanelPrefs(app: App): PanelPrefs {
  const stored: unknown = app.loadLocalStorage(STORAGE_KEY);
  const record = stored !== null && typeof stored === 'object' ? stored as Record<string, unknown> : {};
  const { width, hidden } = record;
  return {
    width: typeof width === 'number' && Number.isFinite(width) ? Math.max(MIN_PANEL_WIDTH, Math.round(width)) : DEFAULT_PANEL_WIDTH,
    hidden: hidden === true,
  };
}

export function savePanelPrefs(app: App, prefs: PanelPrefs): void {
  app.saveLocalStorage(STORAGE_KEY, { width: prefs.width, hidden: prefs.hidden });
}
