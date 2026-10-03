import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SRD_5_2_1_SOURCE } from '../../../../src/app/statblocks/presets/attributions';
import { FakeSession, sampleTemplate } from './editorKit';
import { key, mountEditor, typeAndLeave } from './sidePanesKit';

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

const settings = (): HTMLElement => [...document.querySelectorAll<HTMLElement>('.atlas-te-inspector .atlas-te-insp__fade')].at(-1)!;

describe('the template\'s settings', () => {
  it('show while nothing is selected, and edit the description and the columns one step each', () => {
    const session = new FakeSession(sampleTemplate());
    mountEditor(session);
    expect(settings().querySelector('.atlas-te-insp__name')?.textContent).toBe('Template');
    typeAndLeave(within(settings()).getByRole('textbox', { name: 'Description' }), 'For', 'For marsh creatures');
    expect(session.template.description).toBe('For marsh creatures');
    fireEvent.click(within(settings()).getByRole('radio', { name: '2' }));
    expect(session.template.layout.maxColumns).toBe(2);
    expect(session.steps).toBe(2);
    typeAndLeave(within(settings()).getByRole('textbox', { name: 'Description' }), '');
    expect(session.template).not.toHaveProperty('description');
  });

  it('sets the column width with the slider, one step a press, the default stored as none', () => {
    const session = new FakeSession(sampleTemplate());
    mountEditor(session);
    const thumb = within(settings()).getByRole('slider', { name: 'Column width' });
    expect(thumb.getAttribute('aria-valuenow')).toBe('22');
    key(thumb, 'ArrowRight');
    key(thumb, 'ArrowRight');
    expect(session.template.layout.columnWidth).toBe(24);
    expect(session.steps).toBe(2);
    key(thumb, 'ArrowLeft');
    key(thumb, 'ArrowLeft');
    expect(session.template.layout).not.toHaveProperty('columnWidth');
    expect(within(settings()).getByText('22 em')).toBeTruthy();
  });

  it('says that no role starts from a template, and what a copy is based on', () => {
    mountEditor(new FakeSession({ ...sampleTemplate(), derivedFrom: { templateId: 'builtin:5e-2024-monster', revision: 1 } }));
    expect(within(settings()).getByText('No role starts from it.')).toBeTruthy();
    expect(within(settings()).getByText(/^Based on /).textContent).toMatch(/^Based on .+\.$/);
  });

  it('removes a licensed template\'s credit only after asking', () => {
    const session = new FakeSession({ ...sampleTemplate(), source: SRD_5_2_1_SOURCE });
    mountEditor(session);
    expect(within(settings()).getByText(SRD_5_2_1_SOURCE.attribution)).toBeTruthy();
    fireEvent.click(within(settings()).getByRole('button', { name: 'Remove attribution' }));
    const dialog = screen.getByRole('dialog', { name: 'Remove attribution?' });
    expect(within(dialog).getByText('The licence may require this credit wherever you share the template.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(session.template.source).toEqual(SRD_5_2_1_SOURCE);
    fireEvent.click(within(settings()).getByRole('button', { name: 'Remove attribution' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Remove attribution?' })).getByRole('button', { name: 'Remove' }));
    expect(session.template).not.toHaveProperty('source');
    expect(session.steps).toBe(1);
  });
});
