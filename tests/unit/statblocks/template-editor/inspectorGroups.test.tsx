import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { findBlock } from '../../../../src/app/statblocks/model/treeQueries';
import type { TemplateBlock } from '../../../../src/app/statblocks/model/templateTypes';
import { FakeSession, sampleTemplate, template } from './editorKit';
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

/** The inspector's content for the selection now; the one it shows before fades out beside it. */
const inspector = (): HTMLElement => [...document.querySelectorAll<HTMLElement>('.atlas-te-inspector .atlas-te-insp__fade')].at(-1)!;
const group = (title: string): HTMLElement => {
  const found = [...inspector().querySelectorAll<HTMLElement>('.atlas-te-group')].find((element) => element.querySelector('.atlas-te-group__header')?.textContent === title);
  if (!found) throw new Error(`no group ${title}`);
  return found;
};
const open = (title: string): HTMLElement => {
  const header = within(inspector()).getByRole('button', { name: title });
  if (header.getAttribute('aria-expanded') !== 'true') fireEvent.click(header);
  return group(title);
};
const blockOf = (session: FakeSession, id: string): TemplateBlock | undefined => findBlock(session.template.layout.blocks, id)?.block;
const fieldOf = (session: FakeSession, key: string): unknown => session.template.fields.find((field) => field.key === key);

/** Picks an option of the Atlas Select named `name` inside `container`. */
function choose(container: HTMLElement, name: string, option: string): void {
  fireEvent.click(within(container).getByRole('combobox', { name }));
  fireEvent.click(within(container).getByRole('option', { name: option }));
}

describe('the inspector', () => {
  it('names the selected block and opens Content first', () => {
    const { frame } = mountEditor();
    fireEvent.click(frame('stat-ac1'));
    expect(inspector().querySelector('.atlas-te-insp__name')?.textContent).toBe('Armor class');
    expect(inspector().querySelector('.atlas-te-insp__type')?.textContent).toBe('Stat');
    expect(within(inspector()).getByRole('button', { name: 'Content' }).getAttribute('aria-expanded')).toBe('true');
    expect(within(inspector()).getByRole('button', { name: 'Look' }).getAttribute('aria-expanded')).toBe('false');
  });

  it('edits Content: a typed label is one step, the field\'s type another', () => {
    const { session, frame } = mountEditor();
    fireEvent.click(frame('stat-ac1'));
    const content = group('Content');
    typeAndLeave(within(content).getByRole('textbox', { name: 'Label' }), 'A', 'AC');
    expect(fieldOf(session, 'ac')).toMatchObject({ label: 'AC' });
    expect(session.steps).toBe(1);
    choose(content, 'Type', 'Choice');
    expect(fieldOf(session, 'ac')).toMatchObject({ type: 'choice' });
    typeAndLeave(within(content).getByRole('textbox', { name: 'Options' }), 'Light, Heavy');
    fireEvent.click(within(content).getByRole('switch', { name: 'Allow others' }));
    expect(fieldOf(session, 'ac')).toMatchObject({ options: ['Light', 'Heavy'], open: true });
    expect(session.steps).toBe(4);
  });

  it('edits Look, and remembers which groups are open', () => {
    const { session, frame } = mountEditor();
    fireEvent.click(frame('stat-ac1'));
    const look = open('Look');
    fireEvent.click(within(look).getByRole('radio', { name: 'Stacked' }));
    expect(blockOf(session, 'stat-ac1')).toMatchObject({ look: 'stacked' });
    fireEvent.click(within(look).getByRole('switch', { name: 'Show label' }));
    expect(blockOf(session, 'stat-ac1')).toMatchObject({ label: '' });
    expect(session.steps).toBe(2);
    fireEvent.click(frame('stat-sp1'));
    expect(within(inspector()).getByRole('button', { name: 'Look' }).getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(within(group('Look')).getByRole('radio', { name: 'Fill' }));
    expect(blockOf(session, 'stat-sp1')).toMatchObject({ size: 'fill' });
  });

  it('edits When empty: a fallback pattern, typed as text, is one step', () => {
    const { session, frame } = mountEditor();
    fireEvent.click(frame('stat-hp1'));
    const empty = open('When empty');
    fireEvent.click(within(empty).getByRole('radio', { name: 'Show a fallback' }));
    expect(blockOf(session, 'stat-hp1')).toMatchObject({ whenEmpty: 'fallback' });
    fireEvent.click(within(empty).getByText('Edit as text').closest('button')!);
    typeAndLeave(within(group('When empty')).getByRole('textbox', { name: 'Fallback' }), '{', '{ac', '{ac}');
    expect(blockOf(session, 'stat-hp1')).toMatchObject({ fallback: '{ac}' });
    expect(session.steps).toBe(2);
    expect(within(group('When empty')).getByText('Shows “10”')).toBeTruthy();
    typeAndLeave(within(group('When empty')).getByRole('textbox', { name: 'Prompt' }), 'Add hit points');
    expect(fieldOf(session, 'hp')).toMatchObject({ prompt: 'Add hit points' });
  });

  it('says what is wrong with a pattern in plain words', () => {
    const { frame } = mountEditor();
    fireEvent.click(frame('stat-hp1'));
    const format = open('Format');
    fireEvent.click(within(format).getByText('Edit as text').closest('button')!);
    fireEvent.change(within(group('Format')).getByRole('textbox', { name: 'Pattern' }), { target: { value: '{hp' } });
    expect(within(group('Format')).getByText('A “{” is never closed.')).toBeTruthy();
  });

  it('edits Format: numbers signed, a unit, the dice a stat rolls', () => {
    const base = sampleTemplate();
    const session = new FakeSession({ ...base, fields: [...base.fields, { key: 'hit_dice', label: 'Hit dice', type: 'dice' }] });
    const { frame } = mountEditor(session);
    fireEvent.click(frame('stat-hp1'));
    const format = open('Format');
    fireEvent.click(within(format).getByRole('radio', { name: 'Signed' }));
    typeAndLeave(within(format).getByRole('textbox', { name: 'Unit' }), 'hp');
    const rolls = within(format).getByRole('combobox', { name: 'Rolls' });
    fireEvent.change(rolls, { target: { value: 'hit' } });
    key(rolls, 'Enter');
    expect(blockOf(session, 'stat-hp1')).toMatchObject({ display: 'signed', rollFrom: 'hit_dice' });
    expect(fieldOf(session, 'hp')).toMatchObject({ unit: 'hp' });
    expect(session.steps).toBe(3);
  });

  it('edits Advanced: class, meaning and the condition the block shows under', () => {
    const { session, frame } = mountEditor();
    fireEvent.click(frame('stat-ac1'));
    const advanced = open('Advanced');
    typeAndLeave(within(advanced).getByRole('textbox', { name: 'Class' }), 'armor');
    choose(advanced, 'Meaning', 'Armor');
    fireEvent.click(within(advanced).getByRole('radio', { name: 'Only when' }));
    const field = within(group('Advanced')).getByRole('combobox', { name: 'Field' });
    fireEvent.change(field, { target: { value: 'hit' } });
    key(field, 'Enter');
    expect(blockOf(session, 'stat-ac1')).toMatchObject({ className: 'armor', showWhen: { field: 'hp', is: 'present' } });
    expect(fieldOf(session, 'ac')).toMatchObject({ meaning: 'armor' });
    choose(group('Advanced'), 'Test', 'is more than');
    typeAndLeave(within(group('Advanced')).getByRole('textbox', { name: 'Value' }), '1', '12');
    expect(blockOf(session, 'stat-ac1')).toMatchObject({ showWhen: { field: 'hp', is: 'above', value: 12 } });
    expect(session.steps).toBe(5);
    fireEvent.click(within(group('Advanced')).getByRole('radio', { name: 'Always' }));
    expect(blockOf(session, 'stat-ac1')).not.toHaveProperty('showWhen');
  });

  it('edits a section\'s heading, a row\'s alignment and a heading\'s level', () => {
    const base = sampleTemplate();
    const session = new FakeSession({ ...base, layout: { ...base.layout, blocks: [...base.layout.blocks, { id: 'heading1', type: 'heading', text: 'Actions', level: 'section' }] } });
    const { frame } = mountEditor(session);
    fireEvent.click(frame('section1'));
    typeAndLeave(within(group('Content')).getByRole('textbox', { name: 'Heading' }), 'Guard');
    fireEvent.click(frame('row00001'));
    fireEvent.click(within(open('Look')).getByRole('radio', { name: 'Spread' }));
    fireEvent.click(frame('heading1'));
    fireEvent.click(within(group('Look')).getByRole('radio', { name: 'Minor' }));
    expect(blockOf(session, 'section1')).toMatchObject({ heading: 'Guard' });
    expect(blockOf(session, 'row00001')).toMatchObject({ align: 'spread' });
    expect(blockOf(session, 'heading1')).toMatchObject({ level: 'minor' });
    expect(session.steps).toBe(3);
  });

  it('adds a Scores column and turns it into a save from a pairs field', () => {
    const session = new FakeSession(template(
      [{ id: 'scores01', type: 'scores', field: 'stats', orientation: 'row' }],
      [{ key: 'stats', label: 'Abilities', type: 'scores', slots: ['STR', 'DEX'] }, { key: 'saves', label: 'Saves', type: 'pairs' }],
    ));
    const { frame } = mountEditor(session);
    fireEvent.click(frame('scores01'));
    const look = open('Look');
    fireEvent.click(within(look).getByText('Add column').closest('button')!);
    expect(blockOf(session, 'scores01')).toMatchObject({ columns: [{ label: 'Mod', formula: 'floor((value - 10) / 2)', display: 'signed' }] });
    choose(group('Look'), 'Reads', 'Field, else modifier');
    const field = within(group('Look')).getByRole('combobox', { name: 'Field' });
    fireEvent.change(field, { target: { value: 'sav' } });
    key(field, 'Enter');
    expect(blockOf(session, 'scores01')).toMatchObject({ columns: [{ label: 'Mod', field: 'saves', formula: 'floor((value - 10) / 2)' }] });
    fireEvent.click(within(group('Look')).getByRole('radio', { name: 'Table' }));
    expect(blockOf(session, 'scores01')).toMatchObject({ orientation: 'table' });
    // Choosing "Field" waits for the field: adding, picking and the orientation are the steps.
    expect(session.steps).toBe(3);
  });

  it('shows a built-in\'s settings disabled and takes no edit', () => {
    const session = new FakeSession(sampleTemplate(), { readOnly: true, readOnlyReason: 'built-in', path: null });
    const { frame } = mountEditor(session);
    fireEvent.click(frame('stat-ac1'));
    expect(within(inspector()).getByText('Built-in template. Make a copy to change it.')).toBeTruthy();
    expect(within(group('Content')).getByRole<HTMLInputElement>('textbox', { name: 'Label' }).disabled).toBe(true);
    expect(within(group('Content')).getByRole<HTMLInputElement>('combobox', { name: 'Field' }).disabled).toBe(true);
    expect(session.steps).toBe(0);
  });

  it('asks one block at a time', () => {
    const { frame } = mountEditor();
    fireEvent.click(frame('stat-ac1'));
    fireEvent.click(frame('stat-hp1'), { shiftKey: true });
    expect(within(inspector()).getByText('Select one block to change its settings.')).toBeTruthy();
  });

  it('replaces a preserved script with a block of the catalogue', () => {
    const session = new FakeSession(template([{ id: 'script01', type: 'script', summary: 'Rolls a d20', fs: { type: 'javascript' } }]));
    const { frame } = mountEditor(session);
    fireEvent.click(frame('script01'));
    expect(within(group('Content')).getByText(/Rolls a d20/)).toBeTruthy();
    choose(group('Content'), 'Replace with', 'Stat');
    expect(session.template.layout.blocks.map((block) => block.type)).toEqual(['stat']);
    expect(session.steps).toBe(1);
  });
});

describe('the Rename key dialog', () => {
  it('renames the key in the template only, keeping the old one as a former key', () => {
    const { session, frame } = mountEditor();
    fireEvent.click(frame('stat-ac1'));
    fireEvent.click(within(open('Advanced')).getByRole('button', { name: 'Rename…' }));
    const dialog = screen.getByRole('dialog', { name: 'Rename key' });
    const input = within(dialog).getByRole<HTMLInputElement>('textbox', { name: 'New key' });
    fireEvent.change(input, { target: { value: 'hp' } });
    expect(within(dialog).getByText('Another field already uses “hp”.')).toBeTruthy();
    expect(within(dialog).getByRole<HTMLButtonElement>('button', { name: 'Rename' }).disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'armor_class' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rename' }));
    expect(fieldOf(session, 'armor_class')).toMatchObject({ formerKeys: ['ac'] });
    expect(blockOf(session, 'stat-ac1')).toMatchObject({ field: 'armor_class' });
    expect(session.steps).toBe(1);
    expect(screen.queryByRole('dialog', { name: 'Rename key' })).toBeNull();
    expect(within(group('Advanced')).getByText('Also reads “ac” from statblocks not yet moved over.')).toBeTruthy();
  });
});
