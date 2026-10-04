import '../setup/obsidianDom';
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import css from '../../styles/main.scss?inline';
import panelCss from '../../src/app/statblocks/editor/note-panel/note-statblock-panel.scss?inline';
import { PanelResizeHandle } from '../../src/app/statblocks/editor/note-panel/PanelResizeHandle';
import { DEFAULT_PANEL_WIDTH, MIN_PANEL_WIDTH, NOTE_MIN_WIDTH } from '../../src/app/statblocks/editor/note-panel/panelPrefs';

/**
 * The statblock beside its note with the real stylesheet (§7.2): a Markdown
 * view's content as Obsidian builds it (its rules for `.view-content` and the
 * two editors copied from Obsidian 1.13's app.css), decorated as
 * `NoteStatblockPanel` decorates it. The editors keep their element and only
 * become flex items; the panel sits beside them, resizes, scrolls on its own
 * and stands above them in a narrow view.
 */
const OBSIDIAN = `
  * { box-sizing: border-box; }
  body { margin: 0; font: 13px/1.5 -apple-system, sans-serif; --background-primary: #1e1e1e; --divider-color: #363636;
    --interactive-accent: #7f6df2; --text-faint: #777; --font-ui-smaller: 12px; --header-height: 40px; }
  .workspace-leaf-content { position: absolute; inset: 0; display: flex; flex-direction: column; }
  .view-header { height: var(--header-height); flex: none; }
  .view-content { width: 100%; height: calc(100% - var(--header-height)); }
  .markdown-source-view.mod-cm6 { height: 100%; display: flex; flex-direction: column; }
  .cm-scroller { flex: 1 1; min-height: 0; overflow: auto; }
  .markdown-reading-view { display: flex; flex-direction: column; }
  .metadata-container { display: var(--metadata-display-editing, block); }
`;
const HEIGHT = 800;
const h = React.createElement;
const TOLERANCE = 0.5;

interface Mounted {
  container: HTMLElement;
  content: HTMLElement;
  source: HTMLElement;
  panel: HTMLElement;
  scroll: HTMLElement;
}

/** A decorated view `width` wide: a long note in Live Preview, the reader hidden, and a long statblock beside it. */
function mount(width: number, { stacked = false, panelWidth = DEFAULT_PANEL_WIDTH } = {}): Mounted {
  const frame = document.body.createDiv();
  frame.style.cssText = `position: relative; width: ${width}px; height: ${HEIGHT}px;`;
  const container = frame.createDiv({ cls: ['workspace-leaf-content', 'atlas-sb-note', 'atlas-sb-note--hide-properties'] });
  if (stacked) container.addClass('atlas-sb-note--stacked');
  container.createDiv({ cls: 'view-header' });
  const content = container.createDiv({ cls: 'view-content' });
  const source = content.createDiv({ cls: ['markdown-source-view', 'mod-cm6', 'is-live-preview'] });
  source.createDiv({ cls: 'metadata-container', text: 'Properties' });
  const scroller = source.createDiv({ cls: 'cm-scroller' });
  scroller.createDiv({ text: 'A line of the note. '.repeat(400) });
  const reader = content.createDiv({ cls: 'markdown-reading-view' });
  reader.style.display = 'none';
  const fence = scroller.createDiv({ cls: 'atlas-statblock-fence' });
  fence.createDiv({ text: 'The card a second time' });
  const panel = content.createDiv({ cls: ['atlas-vtt-plugin', 'atlas-sb-note-panel'] });
  panel.style.setProperty('--atlas-sb-panel-width', `${panelWidth}px`);
  const scroll = panel.createDiv({ cls: 'atlas-sb-note-panel__scroll' });
  scroll.createDiv().style.height = '3000px';
  return { container, content, source, panel, scroll };
}

const rect = (element: Element): DOMRect => element.getBoundingClientRect();
const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));

describe('the statblock beside its note', () => {
  const style = document.createElement('style');
  style.textContent = OBSIDIAN + css + panelCss;

  beforeEach(async () => {
    await page.viewport(1400, 900);
    document.head.append(style);
  });

  afterEach(() => {
    cleanup();
    style.remove();
    document.body.replaceChildren();
  });

  it('stands beside the editor at 1200 px, both as high as the view\'s content', () => {
    const { content, source, panel } = mount(1200);
    const box = rect(content);
    expect(rect(source).left).toBeCloseTo(box.left, 1);
    expect(rect(panel).width).toBeCloseTo(DEFAULT_PANEL_WIDTH, 1);
    expect(rect(source).width).toBeCloseTo(1200 - DEFAULT_PANEL_WIDTH, 1);
    expect(Math.abs(rect(panel).left - rect(source).right)).toBeLessThanOrEqual(TOLERANCE);
    expect(rect(panel).right).toBeCloseTo(box.right, 1);
    for (const element of [source, panel]) {
      expect(rect(element).top).toBeCloseTo(box.top, 1);
      expect(rect(element).height).toBeCloseTo(box.height, 1);
    }
  });

  it('never takes the note below its minimum width, nor itself below its own', () => {
    const wide = mount(1200, { panelWidth: 5000 });
    expect(rect(wide.source).width).toBeCloseTo(NOTE_MIN_WIDTH, 1);
    expect(rect(wide.panel).width).toBeCloseTo(1200 - NOTE_MIN_WIDTH, 1);
    document.body.replaceChildren();
    const narrow = mount(1200, { panelWidth: 10 });
    expect(rect(narrow.panel).width).toBeCloseTo(MIN_PANEL_WIDTH, 1);
  });

  it('scrolls on its own, leaving the note where it is', () => {
    const { source, scroll } = mount(1200);
    const scroller = source.querySelector('.cm-scroller')!;
    expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight);
    scroll.scrollTop = 500;
    expect(scroll.scrollTop).toBe(500);
    expect(scroller.scrollTop).toBe(0);
  });

  it('hides the note\'s Properties and shrinks its statblock fence to one line', () => {
    const { source } = mount(1200);
    expect(getComputedStyle(source.querySelector('.metadata-container')!).display).toBe('none');
    const fence = source.querySelector('.atlas-statblock-fence')!;
    expect(getComputedStyle(fence.firstElementChild!).display).toBe('none');
    expect(getComputedStyle(fence, '::before').content).toBe('"Shown beside"');
  });

  it('resizes from its edge with the pointer and the arrow keys', async () => {
    const { panel, content } = mount(1200);
    const widths: Array<[number, boolean]> = [];
    const handleHost = panel.createDiv();
    panel.prepend(handleHost);
    const onResize = (width: number, done: boolean): void => {
      widths.push([width, done]);
      panel.style.setProperty('--atlas-sb-panel-width', `${width}px`);
    };
    render(h(PanelResizeHandle, { width: DEFAULT_PANEL_WIDTH, availableWidth: () => content.clientWidth, onResize }), { container: handleHost });
    const handle = panel.querySelector<HTMLElement>('.atlas-sb-note-panel__handle')!;
    // The hit area starts inside the panel's border, so the editor's scrollbar beside it keeps its clicks.
    expect(rect(handle).left).toBeCloseTo(rect(panel).left + parseFloat(getComputedStyle(panel).borderLeftWidth), 1);
    expect(getComputedStyle(handle).cursor).toBe('col-resize');

    const at = { x: rect(handle).left + 2, y: rect(handle).top + 100 };
    const send = (type: string, x: number): void => {
      (type === 'pointerdown' ? handle : window).dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, clientX: x, clientY: at.y, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0,
      }));
    };
    await act(async () => {
      send('pointerdown', at.x);
      send('pointermove', at.x - 60);
      await frame();
      send('pointerup', at.x - 100);
    });
    expect(widths.at(-1)).toEqual([DEFAULT_PANEL_WIDTH + 100, true]);
    expect(rect(panel).width).toBeCloseTo(DEFAULT_PANEL_WIDTH + 100, 1);
    expect(document.body.classList.contains('atlas-sb-panel-resizing')).toBe(false);

    handle.focus();
    await act(async () => { handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); });
    expect(rect(panel).width).toBeCloseTo(DEFAULT_PANEL_WIDTH + 84, 1);
  });

  it('stands above the note in a narrow view, at most half its height, and scrolls there', () => {
    const { content, source, panel, scroll } = mount(640, { stacked: true });
    const box = rect(content);
    expect(rect(panel).top).toBeCloseTo(box.top, 1);
    expect(rect(panel).width).toBeCloseTo(640, 1);
    expect(rect(panel).height).toBeLessThanOrEqual(box.height / 2 + TOLERANCE);
    expect(Math.abs(rect(source).top - rect(panel).bottom)).toBeLessThanOrEqual(TOLERANCE);
    expect(rect(source).bottom).toBeCloseTo(box.bottom, 1);
    expect(rect(source).width).toBeCloseTo(640, 1);
    expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight);
  });
});
