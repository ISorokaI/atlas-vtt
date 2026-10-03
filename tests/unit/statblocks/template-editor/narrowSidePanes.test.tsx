import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { placeBeside } from '../../../../src/app/statblocks/editor/template-editor/inspector/besidePlacement';
import { FakeSession, sampleTemplate } from './editorKit';
import { mountEditor } from './sidePanesKit';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
  Element.prototype.scrollIntoView = vi.fn();
  Range.prototype.getBoundingClientRect = (): DOMRect => new DOMRect(0, 0, 40, 16);
});
afterAll(() => { MotionGlobalConfig.skipAnimations = false; });
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const escape = (target: Element): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  act(() => { target.dispatchEvent(event); });
  return event;
};

describe('where the narrow inspector stands', () => {
  const view = { left: 0, top: 0, right: 800, bottom: 600 };
  const size = { width: 280, height: 300 };

  it('stands right of the block where it fits, else left of it, else under it', () => {
    expect(placeBeside({ left: 100, top: 50, right: 400, bottom: 90 }, view, size)).toEqual({ left: 408, top: 50, side: 'right' });
    expect(placeBeside({ left: 400, top: 50, right: 700, bottom: 90 }, view, size)).toEqual({ left: 112, top: 50, side: 'left' });
    expect(placeBeside({ left: 100, top: 50, right: 750, bottom: 90 }, view, size)).toEqual({ left: 100, top: 98, side: 'below' });
  });

  it('keeps its top inside the view', () => {
    expect(placeBeside({ left: 100, top: 500, right: 300, bottom: 540 }, view, size).top).toBe(300);
    expect(placeBeside({ left: 100, top: -80, right: 300, bottom: 40 }, view, size).top).toBe(0);
  });
});

describe('below 900 px of view width', () => {
  it('folds the left pane into a rail of icons whose tabs open floating panels', async () => {
    mountEditor(new FakeSession(sampleTemplate()), { narrow: true });
    expect(document.querySelector('.atlas-te')?.getAttribute('data-layout')).toBe('narrow');
    expect(screen.queryByRole('radiogroup', { name: 'Side pane' })).toBeNull();
    const rail = screen.getByRole('toolbar', { name: 'Side pane' });
    expect(within(rail).getAllByRole('button').map((button) => button.textContent)).toEqual(['Blocks', 'Outline', 'Fields', 'Template settings']);

    const outline = within(rail).getByRole('button', { name: 'Outline' });
    act(() => outline.focus());
    fireEvent.click(outline);
    const panel = screen.getByRole('dialog', { name: 'Outline' });
    expect(within(panel).getByRole('tree', { name: 'Blocks' })).toBeTruthy();
    expect(outline.classList.contains('is-active')).toBe(true);
    expect(escape(within(panel).getAllByRole('treeitem')[0]!).defaultPrevented).toBe(true);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Outline' })).toBeNull());
    expect(document.activeElement).toBe(outline);

    fireEvent.click(within(rail).getByRole('button', { name: 'Template settings' }));
    expect(within(screen.getByRole('dialog', { name: 'Template settings' })).getByRole('textbox', { name: 'Description' })).toBeTruthy();
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Template settings' })).toBeNull());
  });

  it('opens the inspector as a popover beside the selected block, which Escape puts away', async () => {
    const { frame } = mountEditor(new FakeSession(sampleTemplate()), { narrow: true });
    expect(screen.queryByRole('dialog', { name: 'Block settings' })).toBeNull();
    fireEvent.click(frame('stat-ac1'));
    const popover = screen.getByRole('dialog', { name: 'Block settings' });
    expect(popover.closest('.atlas-te-inspector')).not.toBeNull();
    expect(popover.querySelector('.atlas-te-insp__name')?.textContent).toBe('Armor class');
    const label = within(popover).getByRole('textbox', { name: 'Label' });
    expect(escape(label).defaultPrevented).toBe(true);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Block settings' })).toBeNull());
    expect(document.activeElement).toBe(frame('stat-ac1'));
    expect(frame('stat-ac1').getAttribute('data-te-selected')).toBe('primary');
    fireEvent.click(frame('stat-ac1'));
    expect(screen.getByRole('dialog', { name: 'Block settings' })).toBeTruthy();
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Block settings' })).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Block settings' })).toBeNull());
  });
});
