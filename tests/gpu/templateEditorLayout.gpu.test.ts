import '../setup/obsidianDom';
import { act, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SRD_5_2_1_SOURCE } from '../../src/app/statblocks/presets/attributions';
import { FakeSession, sampleTemplate } from '../unit/statblocks/template-editor/editorKit';
import { frame, frames, mount, px, useEditorStyles, wait } from './sidePanesHarness';

// Dice links and the header's file actions reach the map view and the token link service, whose
// Node `events` has no browser build; nothing here rolls dice or writes files.
vi.mock('../../src/app/services/statblockDiceLinks', () => ({
  attachDiceRolling: () => () => undefined,
  diceLinkProps: () => ({}),
  linkDiceIn: () => undefined,
  splitDiceSegments: (text: string) => [{ text, dice: false }],
}));
vi.mock('../../src/app/statblocks/render/shared/useStatblockDiceRolling', () => ({ useStatblockDiceRolling: () => undefined }));
vi.mock('../../src/app/statblocks/editor/template-editor/templateEditorActions', () => ({
  duplicateTemplate: async () => null,
  newStatblockFromTemplate: async () => undefined,
}));

/**
 * The template editor's left pane and inspector with the real stylesheet
 * (§7.10): padding equals the gap, corners are concentric, only transform and
 * opacity animate, and below 900 px the inspector folds into a popover.
 */
const TOLERANCE = 0.5;
/**
 * Elevated surfaces have a 1.5 px border (`$border-width-m`), which Chrome
 * draws 1 px wide at a device pixel ratio of 1, as here. Insets measured from
 * the outer edge are put back to the border the corners were worked out for.
 */
const BORDER = 1.5;
const drawnBorder = (element: Element): number => px(getComputedStyle(element).borderTopWidth);
const ANIMATABLE = new Set(['transform', 'opacity', 'translate', 'scale', 'rotate']);
/** Padding on all four sides and the gaps between children, of one container. */
function spacing(element: Element): { padding: number[]; rowGap: number; columnGap: number } {
  const style = getComputedStyle(element);
  return {
    padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].map(px),
    rowGap: px(style.rowGap),
    columnGap: px(style.columnGap),
  };
}

function expectUniform(element: Element, what: string, axes: Array<'rowGap' | 'columnGap'> = ['rowGap']): number {
  const { padding, ...gaps } = spacing(element);
  const [first = 0] = padding;
  for (const side of padding) expect(side, `${what}: padding on every side`).toBeCloseTo(first, 1);
  for (const axis of axes) expect(gaps[axis], `${what}: ${axis} equals padding`).toBeCloseTo(first, 1);
  expect(first, `${what}: has padding`).toBeGreaterThan(0);
  return first;
}

/** A panel's close button sits the same gap from the top and the end, its corner concentric with the panel's. */
function expectConcentricClose(panel: Element, what: string): void {
  const button = panel.querySelector('.atlas-close-btn')!;
  const outer = panel.getBoundingClientRect();
  const inner = button.getBoundingClientRect();
  const correction = BORDER - drawnBorder(panel);
  const top = inner.top - outer.top + correction;
  const end = outer.right - inner.right + correction;
  expect(top, `${what}: the same gap above and beside the close button`).toBeCloseTo(end, 0);
  const panelRadius = px(getComputedStyle(panel).borderTopRightRadius);
  const buttonRadius = px(getComputedStyle(button).borderTopRightRadius);
  expect(Math.abs(buttonRadius + end - panelRadius), `${what}: close button concentric (${buttonRadius} + ${end} vs ${panelRadius})`).toBeLessThan(TOLERANCE);
}

/**
 * What animated while `act` ran and for a moment after: the properties of Web
 * Animations and CSS transitions in the editor, and any style property a
 * script set to more than two values on one element (a tween in JS).
 */
async function animatedWhile(run: () => void | Promise<void>): Promise<string[]> {
  const seen = new Map<Element, Map<string, Set<string>>>();
  const props = new Set<string>();
  const note = (): void => {
    for (const animation of document.getAnimations()) {
      const effect = animation.effect;
      if (!(effect instanceof KeyframeEffect) || !effect.target?.closest('.atlas-vtt-plugin')) continue;
      if (animation instanceof CSSTransition) props.add(animation.transitionProperty);
      else for (const keyframe of effect.getKeyframes()) {
        for (const name of Object.keys(keyframe)) if (!['offset', 'computedOffset', 'easing', 'composite'].includes(name)) props.add(name);
      }
    }
  };
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (!(record.target instanceof HTMLElement) || !record.target.closest('.atlas-vtt-plugin')) continue;
      const style = record.target.style;
      const values = seen.get(record.target) ?? new Map<string, Set<string>>();
      seen.set(record.target, values);
      for (let index = 0; index < style.length; index++) {
        const name = style.item(index);
        if (name.startsWith('--')) continue;
        const list = values.get(name) ?? new Set<string>();
        list.add(style.getPropertyValue(name));
        values.set(name, list);
      }
    }
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['style'], subtree: true });
  await act(async () => { await run(); });
  for (let sample = 0; sample < 12; sample++) {
    note();
    await frames(2);
  }
  observer.disconnect();
  for (const values of seen.values()) for (const [name, list] of values) if (list.size > 2) props.add(name);
  return [...props].filter((name) => !ANIMATABLE.has(name));
}

describe('the template editor\'s side panes', () => {
  useEditorStyles();
  afterEach(cleanup);

  it('pads the left pane, the palette tiles and the inspector groups as much as they space their children', async () => {
    mount(new FakeSession(sampleTemplate()), 1180);
    await frames(2);
    expect(document.querySelector('.atlas-te-left')!.getBoundingClientRect().width).toBeCloseTo(260, 0);
    expectUniform(document.querySelector('.atlas-te-pane__body')!, 'left pane');
    const grid = document.querySelector('.atlas-te-palette__grid')!;
    const tilePadding = expectUniform(document.querySelector('.atlas-te-tile')!, 'palette tile');
    expect(spacing(grid).columnGap, 'tiles stand as far apart as their padding').toBeCloseTo(tilePadding, 1);
    const tile = document.querySelector('.atlas-te-tile')!.getBoundingClientRect();
    expect(grid.getBoundingClientRect().width).toBeCloseTo(tile.width * 2 + tilePadding, 0);
    // The miniature and the name, measured: the gap between them is the tile's padding.
    const preview = document.querySelector('.atlas-te-tile__preview')!.getBoundingClientRect();
    const label = document.querySelector('.atlas-te-tile__label')!.getBoundingClientRect();
    expect(label.top - preview.bottom).toBeCloseTo(tilePadding, 0);

    await act(async () => { frame('stat-ac1').click(); });
    await frames(2);
    for (const group of document.querySelectorAll('.atlas-te-inspector .atlas-te-group')) {
      expectUniform(group, `inspector group ${group.getAttribute('data-group') ?? ''}`, ['rowGap', 'columnGap']);
    }
    expect(document.querySelector('.atlas-te-inspector')!.getBoundingClientRect().width).toBeCloseTo(280, 0);
  });

  it('keeps the block toolbar\'s capsule and the dialogs\' close buttons concentric', async () => {
    mount(new FakeSession({ ...sampleTemplate(), source: SRD_5_2_1_SOURCE }), 1180);
    await act(async () => { frame('stat-ac1').click(); });
    await frames(2);
    const toolbar = document.querySelector('.atlas-te-toolbar')!;
    const bar = toolbar.getBoundingClientRect();
    const button = toolbar.querySelector('.atlas-tool-button button')!.getBoundingClientRect();
    const barRadius = px(getComputedStyle(toolbar).borderTopLeftRadius);
    const buttonRadius = px(getComputedStyle(toolbar.querySelector('.atlas-tool-button button')!).borderTopLeftRadius);
    const start = button.left - bar.left + BORDER - drawnBorder(toolbar);
    expect(barRadius, 'the toolbar is a capsule').toBeCloseTo(bar.height / 2, 1);
    expect(button.top - bar.top, 'its buttons stand as far from the top as from the start').toBeCloseTo(start, 1);
    expect(Math.abs(buttonRadius + start - barRadius), 'its buttons concentric with its ends').toBeLessThan(TOLERANCE);

    const advanced = [...document.querySelectorAll<HTMLElement>('.atlas-te-inspector .atlas-te-group__header')].find((header) => header.textContent === 'Advanced')!;
    await act(async () => { advanced.click(); });
    const rename = [...document.querySelectorAll<HTMLButtonElement>('.atlas-te-inspector button')].find((element) => element.textContent === 'Rename…')!;
    await act(async () => { rename.click(); });
    await wait(400);
    expectConcentricClose(document.querySelector('.atlas-te-dialog')!, 'Rename key');
    await act(async () => { document.querySelector<HTMLButtonElement>('.atlas-te-dialog .atlas-close-btn')!.click(); });
    await wait(300);

    await act(async () => { document.querySelector<HTMLElement>('.atlas-te-stage')!.click(); });
    const remove = [...document.querySelectorAll<HTMLButtonElement>('.atlas-te-inspector button')].find((element) => element.textContent === 'Remove attribution')!;
    await act(async () => { remove.click(); });
    await wait(400);
    expectConcentricClose(document.querySelector('.atlas-te-dialog')!, 'Remove attribution');
  });

  it('keeps the block toolbar on its block when a conflict bar opens above the canvas and when it goes', async () => {
    const session = new FakeSession(sampleTemplate());
    mount(session, 1180);
    await act(async () => { frame('stat-hp1').click(); });
    await frames(2);
    const gap = (): number => frame('stat-hp1').getBoundingClientRect().top - document.querySelector('.atlas-te-toolbar')!.getBoundingClientRect().bottom;
    const resting = gap();
    expect(resting).toBeGreaterThan(0);
    const blockTop = frame('stat-hp1').getBoundingClientRect().top;
    await act(async () => { session.patch({ conflict: 'changed', saveState: 'conflict' }); });
    await frames(3);
    expect(frame('stat-hp1').getBoundingClientRect().top, 'the bar moved the canvas down').toBeGreaterThan(blockTop + 10);
    expect(gap()).toBeCloseTo(resting, 0);
    await act(async () => { session.patch({ conflict: null, saveState: 'saved' }); });
    await frames(3);
    expect(gap()).toBeCloseTo(resting, 0);
  });

  it('keeps the narrow inspector popover\'s border whole where it is taller than the room: the panel scrolls inside it', async () => {
    mount(new FakeSession(sampleTemplate()), 860);
    await frames(3);
    await act(async () => { frame('stat-hp1').click(); });
    await wait(400);
    for (const name of ['Look', 'When empty', 'Format', 'Advanced']) {
      const header = [...document.querySelectorAll<HTMLElement>('.atlas-te-insp-popover .atlas-te-group__header')].find((element) => element.textContent === name);
      if (header?.getAttribute('aria-expanded') !== 'true') await act(async () => { header?.click(); });
    }
    await wait(400);
    const panel = document.querySelector<HTMLElement>('.atlas-te-insp-popover__panel')!;
    expect(panel.scrollHeight, 'the open groups are taller than the room').toBeGreaterThan(panel.clientHeight);
    const box = panel.getBoundingClientRect();
    expect(box.bottom, 'its bottom border shows inside the window').toBeLessThanOrEqual(window.innerHeight);
    expect(px(getComputedStyle(panel).borderBottomWidth)).toBeGreaterThan(0);
  });

  it('animates only transform and opacity: the inspector\'s crossfade, its groups, the panels and the popover', async () => {
    const root = mount(new FakeSession(sampleTemplate()), 1180);
    await frames(2);
    expect(await animatedWhile(() => frame('stat-ac1').click()), 'selecting a block').toEqual([]);
    expect(await animatedWhile(() => frame('stat-hp1').click()), 'the next block').toEqual([]);
    const look = [...document.querySelectorAll<HTMLElement>('.atlas-te-inspector .atlas-te-group__header')].find((header) => header.textContent === 'Look')!;
    expect(await animatedWhile(() => look.click()), 'opening a group').toEqual([]);
    const outline = [...root.querySelectorAll<HTMLButtonElement>('.atlas-segmented__option')].find((option) => option.textContent === 'Outline')!;
    expect(await animatedWhile(() => outline.click()), 'switching tabs').toEqual([]);

    root.parentElement!.style.width = '860px';
    await wait(100);
    expect(root.getAttribute('data-layout')).toBe('narrow');
    const blocks = [...root.querySelectorAll<HTMLButtonElement>('.atlas-te-rail button')].find((button) => button.textContent === 'Blocks')!;
    expect(await animatedWhile(() => blocks.click()), 'a rail panel').toEqual([]);
    await act(async () => { root.querySelector<HTMLElement>('.atlas-te-stage')!.click(); });
    await wait(300);
    expect(await animatedWhile(() => frame('stat-ac1').click()), 'the popover opening').toEqual([]);
    expect(await animatedWhile(() => frame('stat-hp1').click()), 'the popover\'s crossfade').toEqual([]);
  });

  it('folds the left pane into a rail and the inspector into a popover beside the block below 900 px', async () => {
    const root = mount(new FakeSession(sampleTemplate()), 860);
    await frames(3);
    expect(root.getAttribute('data-layout')).toBe('narrow');
    expect(document.querySelector('.atlas-te-left')!.getBoundingClientRect().width).toBeCloseTo(40, 0);
    expect(document.querySelector('.atlas-te-inspector')!.getBoundingClientRect().width).toBe(0);
    for (const button of document.querySelectorAll('.atlas-te-rail button')) {
      const box = button.getBoundingClientRect();
      expect(Math.min(box.width, box.height), 'rail targets are at least 24 px').toBeGreaterThanOrEqual(24);
    }
    expectUniform(document.querySelector('.atlas-te-rail')!, 'rail');
    expect(document.querySelector('.atlas-te-main')!.getBoundingClientRect().width).toBeGreaterThanOrEqual(320);

    await act(async () => { frame('stat-hp1').click(); });
    await wait(400);
    const popover = document.querySelector<HTMLElement>('.atlas-te-insp-popover')!;
    expect(popover.getAttribute('role')).toBe('dialog');
    const box = popover.getBoundingClientRect();
    const block = frame('stat-hp1').getBoundingClientRect();
    const view = document.querySelector('.atlas-te-canvas__scroller')!.getBoundingClientRect();
    const overlaps = box.left < block.right && box.right > block.left && box.top < block.bottom && box.bottom > block.top;
    expect(overlaps, 'the popover stands beside the block, not over it').toBe(false);
    expect(box.width).toBeCloseTo(280, 0);
    expect(box.left).toBeGreaterThanOrEqual(view.left - TOLERANCE);
    expect(box.right).toBeLessThanOrEqual(view.right + TOLERANCE);
    expectConcentricClose(popover.querySelector('.atlas-te-insp-popover__panel')!, 'inspector popover');
    for (const group of popover.querySelectorAll('.atlas-te-group')) expectUniform(group, 'popover group', ['rowGap', 'columnGap']);

    const outline = [...root.querySelectorAll<HTMLButtonElement>('.atlas-te-rail button')].find((button) => button.textContent === 'Outline')!;
    await act(async () => { outline.click(); });
    await wait(400);
    const flyout = document.querySelector('.atlas-te-flyout__panel')!;
    expect(flyout.querySelector('[role="tree"]')).not.toBeNull();
    expect(flyout.getBoundingClientRect().left).toBeGreaterThan(document.querySelector('.atlas-te-rail')!.getBoundingClientRect().right);
    expectConcentricClose(flyout, 'rail panel');
    expectUniform(flyout.querySelector('.atlas-te-flyout__body')!, 'rail panel body');
  });
});
