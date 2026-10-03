import { MotionGlobalConfig } from 'framer-motion';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { App, TFile } from 'obsidian';
import { TemplateLibrary } from '../../../../src/app/statblocks/library/TemplateLibrary';
import { releaseTemplateSessions } from '../../../../src/app/statblocks/library/sessionRegistry';
import type { StatblockTemplate } from '../../../../src/app/statblocks/model/templateTypes';
import { MARSH_ID, MARSH_PATH, TEMPLATE_FOLDER, marshText } from '../library/templateTexts';
import { NOTE_PATH, renderPane, type PaneHarness } from './paneKit';

vi.mock('../../../../src/app/services/AssetService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../src/app/services/AssetService')>();
  const assets = {
    getCollections: async () => [{ id: 'campaign', name: 'Campaign' }],
    loadedCollections: () => [],
    getAssets: async () => [],
    getDefaultCollectionId: () => 'campaign',
    getCollectionSettings: () => ({ conditions: [] }),
  };
  return { ...actual, AssetService: { getInstance: () => assets } };
});
vi.mock('../../../../src/app/statblocks/editor/openTemplateEditor', () => ({ openTemplateEditor: vi.fn(async () => null) }));

const OTHER_NOTE = 'Bestiary/Bog Hag.md';
const WARDEN = { statblock: true, 'atlas-template': MARSH_ID, name: 'Marsh Warden', lair: 'A sunken causeway' };
const apps: App[] = [];

beforeAll(() => { MotionGlobalConfig.skipAnimations = true; });
afterAll(() => { MotionGlobalConfig.skipAnimations = false; });
beforeEach(() => { Element.prototype.scrollIntoView = vi.fn(); });
afterEach(async () => {
  cleanup();
  for (const app of apps.splice(0)) {
    await releaseTemplateSessions(app);
    TemplateLibrary.release(app);
  }
});

/** The pane over the Warden, whose template the metadata cache says `users` statblocks name. */
async function pane(frontmatter: Record<string, unknown> = WARDEN, users: string[] = [NOTE_PATH], actions = {}): Promise<PaneHarness> {
  const files = { [NOTE_PATH]: '---\nstatblock: true\n---\n', [OTHER_NOTE]: '---\nstatblock: true\n---\n', [MARSH_PATH]: marshText() };
  const harness = await renderPane({ frontmatter, files, actions });
  apps.push(harness.app);
  vi.mocked(harness.app.metadataCache.getFileCache).mockImplementation((file: TFile) => (
    users.includes(file.path) ? { frontmatter: { statblock: true, 'atlas-template': frontmatter['atlas-template'] } } : null));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add a field…' })).toBeTruthy());
  return harness;
}

const templateAt = async (harness: PaneHarness, path: string): Promise<StatblockTemplate> => {
  const file = harness.app.vault.getFileByPath(path)!;
  return JSON.parse(await harness.app.vault.read(file)) as StatblockTemplate;
};
const pickNewField = async (name: string, kind: string): Promise<void> => {
  fireEvent.click(screen.getByRole('button', { name: 'Add a field…' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Field name' }), { target: { value: name } });
  const group = screen.getByRole('group', { name: `New field “${name}”` });
  await act(async () => { fireEvent.click(within(group).getByRole('option', { name: kind })); });
};

describe('Add a field… in the statblock pane', () => {
  it('adds the field to a template only this statblock uses, at its end, and moves focus to it', async () => {
    const harness = await pane();
    await pickNewField('Habitat', 'Text');
    expect(screen.queryByRole('group', { name: 'Where the field goes' })).toBeNull();
    const added = await waitFor(() => {
      const card = harness.result.container.querySelector('.atlas-sb-pane-card')!;
      const block = [...card.querySelectorAll<HTMLElement>('[data-block-id]')].at(-1)!;
      expect(block.getAttribute('aria-label')).toBe('Edit Habitat');
      return block;
    });
    await waitFor(() => expect(document.activeElement).toBe(added));
    await waitFor(async () => expect((await templateAt(harness, MARSH_PATH)).fields.at(-1)).toEqual({ key: 'habitat', label: 'Habitat', type: 'text' }));
    expect(harness.writer.writes).toEqual([]);
    expect(document.querySelector('.atlas-sb-pane-live')?.textContent).toBe('Added Habitat to Marsh creature.');
  });

  it('offers the note\'s own keys the template leaves out', async () => {
    const harness = await pane();
    fireEvent.click(screen.getByRole('button', { name: 'Add a field…' }));
    const group = screen.getByRole('group', { name: 'In this note' });
    await act(async () => { fireEvent.click(within(group).getByRole('option', { name: /Lair/ })); });
    await waitFor(async () => expect((await templateAt(harness, MARSH_PATH)).fields.at(-1)?.key).toBe('lair'));
  });

  it('asks before changing a template other statblocks share, and changes it for all on request', async () => {
    const harness = await pane(WARDEN, [NOTE_PATH, OTHER_NOTE]);
    await pickNewField('Habitat', 'Text');
    const question = screen.getByRole('group', { name: 'Where the field goes' });
    expect(question.textContent).toContain('2 statblocks use Marsh creature.');
    await act(async () => { fireEvent.click(within(question).getByRole('button', { name: 'Change the template for all 2 statblocks' })); });
    await waitFor(async () => expect((await templateAt(harness, MARSH_PATH)).fields.at(-1)?.key).toBe('habitat'));
    expect(harness.writer.writes).toEqual([]);
  });

  it('makes a copy for this statblock alone on request, and names it in the note', async () => {
    const harness = await pane(WARDEN, [NOTE_PATH, OTHER_NOTE]);
    await pickNewField('Habitat', 'Number');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Make a copy for this one' })); });
    const copyPath = `${TEMPLATE_FOLDER}/Marsh creature copy.atlastemplate`;
    await waitFor(async () => expect((await templateAt(harness, copyPath)).fields.at(-1)).toEqual({ key: 'habitat', label: 'Habitat', type: 'number' }));
    const copy = await templateAt(harness, copyPath);
    expect(harness.writer.patches()).toEqual([{ op: 'set', path: ['atlas-template'], base: MARSH_ID, next: copy.id }]);
    expect((await templateAt(harness, MARSH_PATH)).fields.some((field) => field.key === 'habitat')).toBe(false);
  });

  it('always makes a copy of a built-in, without asking', async () => {
    const harness = await pane({ ...WARDEN, 'atlas-template': 'builtin:generic-creature' }, [NOTE_PATH, OTHER_NOTE]);
    await pickNewField('Lair actions', 'Entries');
    expect(screen.queryByRole('group', { name: 'Where the field goes' })).toBeNull();
    const copyPath = `${TEMPLATE_FOLDER}/Creature copy.atlastemplate`;
    await waitFor(async () => expect((await templateAt(harness, copyPath)).fields.at(-1)?.key).toBe('lair_actions'));
    const copy = await templateAt(harness, copyPath);
    expect(copy.derivedFrom).toEqual({ templateId: 'builtin:generic-creature', revision: 1 });
    expect(harness.writer.patches()).toEqual([{ op: 'set', path: ['atlas-template'], base: 'builtin:generic-creature', next: copy.id }]);
  });
});

describe('Add to template in the tray', () => {
  it('adds the note\'s key to the template and opens the template editor on its block', async () => {
    const openTemplateAt = vi.fn();
    const harness = await pane(WARDEN, [NOTE_PATH], { openTemplateAt });
    fireEvent.click(screen.getByRole('button', { name: /More properties/ }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add to template' })); });
    await waitFor(() => expect(openTemplateAt).toHaveBeenCalledTimes(1));
    const target = openTemplateAt.mock.calls[0]![0] as { templateId: string; path: string; blockId: string; collectionId: string; notePath: string };
    expect(target).toMatchObject({ templateId: MARSH_ID, path: MARSH_PATH, collectionId: 'campaign', notePath: NOTE_PATH });
    const current = TemplateLibrary.forApp(harness.app).current(MARSH_ID)!.template;
    expect(current.layout.blocks.at(-1)).toMatchObject({ id: target.blockId, field: 'lair' });
  });

  it('is not offered until the template editor is wired in', async () => {
    await pane();
    fireEvent.click(screen.getByRole('button', { name: /More properties/ }));
    expect(screen.queryByRole('button', { name: 'Add to template' })).toBeNull();
  });
});

describe('Save as a template', () => {
  it('turns a Fantasy Statblocks statblock read without the plugin into a template, opened previewing it', async () => {
    const { openTemplateEditor } = await import('../../../../src/app/statblocks/editor/openTemplateEditor');
    const harness = await renderPane({ frontmatter: { statblock: true, name: 'Bog Hag', hp: 30 } });
    apps.push(harness.app);
    fireEvent.keyDown(screen.getByRole('button', { name: 'More statblock actions' }), { key: 'Enter' });
    await act(async () => { fireEvent.click(await screen.findByRole('menuitem', { name: 'Save as a template' })); });
    const path = `${TEMPLATE_FOLDER}/Marsh Warden.atlastemplate`;
    await waitFor(() => expect(openTemplateEditor).toHaveBeenCalledWith(harness.app, expect.objectContaining({ path, previewPath: NOTE_PATH })));
    expect((await templateAt(harness, path)).fields.map((field) => field.key)).toEqual(['name', 'hp']);
  });

  it('is not offered for a native statblock', async () => {
    await pane();
    fireEvent.keyDown(screen.getByRole('button', { name: 'More statblock actions' }), { key: 'Enter' });
    await screen.findByRole('menuitem', { name: 'Open in new window' });
    expect(screen.queryByRole('menuitem', { name: 'Save as a template' })).toBeNull();
  });
});
