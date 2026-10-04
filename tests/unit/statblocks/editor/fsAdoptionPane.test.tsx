import React from 'react';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { copyFenceIntoStatblock } from '../../../../src/app/statblocks/editor/statblock-pane/fenceCopy';
import { TemplateLibrary } from '../../../../src/app/statblocks/library/TemplateLibrary';
import { TEMPLATE_FOLDER } from '../../../../src/app/statblocks/library/templatePaths';
import { LAYOUTS } from '../fs-import/fsImportKit';
import { NOTE_PATH, renderPane, type PaneHarness, type PaneOptions } from './paneKit';

const fs = vi.hoisted(() => ({ on: true }));
vi.mock('../../../../src/app/services/FantasyStatblocksService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../src/app/services/FantasyStatblocksService')>();
  const layouts = (): typeof LAYOUTS | null => (fs.on ? LAYOUTS : null);
  return {
    ...actual,
    isFantasyStatblocksAvailable: () => fs.on,
    allLayouts: layouts,
    defaultLayout: () => layouts()?.[0] ?? null,
    findLayout: (_app: unknown, key: string) => layouts()?.find((layout) => layout.id === key || layout.name === key) ?? null,
  };
});
vi.mock('../../../../src/app/services/AssetService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../src/app/services/AssetService')>();
  const assets = {
    getCollections: async () => [{ id: 'campaign', name: 'Campaign' }],
    getAssets: async () => [],
    getDefaultCollectionId: () => 'campaign',
    getCollectionSettings: () => ({ conditions: [], statblockRoles: [{ id: 'monster', name: 'Monster', templateId: 'builtin:generic-creature' }] }),
  };
  return { ...actual, AssetService: { getInstance: () => assets } };
});
// The read-only Fantasy Statblocks look is LinkedStatblock's own; here it only has to be there.
vi.mock('../../../../src/app/statblocks/render/LinkedStatblock', () => ({
  LinkedStatblock: ({ path }: { path: string }) => <div data-testid="fs-statblock">{path}</div>,
}));
vi.mock('../../../../src/app/statblocks/editor/statblock-pane/fenceCopy', () => ({ copyFenceIntoStatblock: vi.fn(async () => null) }));

const GOBLIN = { statblock: true, name: 'Goblin', layout: 'Marsh layout', hp: 7 };
const apps: App[] = [];

beforeAll(() => { MotionGlobalConfig.skipAnimations = true; });
afterAll(() => { MotionGlobalConfig.skipAnimations = false; });
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  fs.on = true;
  for (const app of apps.splice(0)) TemplateLibrary.release(app);
});

async function pane(options: PaneOptions): Promise<PaneHarness> {
  const harness = await renderPane(options);
  apps.push(harness.app);
  await waitFor(() => expect(TemplateLibrary.forApp(harness.app).isLoading()).toBe(false));
  return harness;
}

const editableBlocks = (container: HTMLElement): number => container.querySelectorAll('.atlas-sb-pane-value').length;

async function choose(menu: string, item: RegExp): Promise<void> {
  fireEvent.keyDown(screen.getByRole('button', { name: menu }), { key: 'Enter' });
  const entry = await screen.findByRole('menuitem', { name: item });
  await act(async () => { fireEvent.click(entry); });
}

describe('a Fantasy Statblocks statblock in the pane, with the plugin on (§6.4)', () => {
  it('shows read-only in its own look, and Edit with an Atlas template imports its layout and writes atlas-template alone', async () => {
    const { result, writer, app } = await pane({ frontmatter: GOBLIN });
    expect(screen.getByTestId('fs-statblock').textContent).toBe(NOTE_PATH);
    expect(screen.getByText('Made with Fantasy Statblocks')).toBeTruthy();
    expect(editableBlocks(result.container)).toBe(0);

    await choose('Edit with an Atlas template', /^Marsh layout/);
    await waitFor(() => expect(writer.patches()).toHaveLength(1));
    const imported = TemplateLibrary.forApp(app).list().find((entry) => entry.template.importedFrom?.layoutName === 'Marsh layout')!;
    expect(imported.path).toBe(`${TEMPLATE_FOLDER}/Marsh layout.atlastemplate`);
    expect(writer.patches()).toEqual([{ op: 'set', path: ['atlas-template'], base: undefined, next: imported.template.id }]);
    // The import's report, with its scripts, opens over the pane.
    expect(await screen.findByRole('dialog', { name: 'Imported Marsh layout' })).toBeTruthy();
  });

  it('offers the template imported before, and the role\'s template in the same menu', async () => {
    const { writer } = await pane({ frontmatter: GOBLIN });
    await choose('Edit with an Atlas template', /^Marsh layout/);
    fireEvent.click(await screen.findByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // The fake writer leaves the note as it was: the menu now names the template the layout gave.
    fireEvent.keyDown(screen.getByRole('button', { name: 'Edit with an Atlas template' }), { key: 'Enter' });
    expect((await screen.findAllByRole('menuitem')).map((item) => item.textContent)).toEqual(['Marsh layoutFrom its layout', 'MonsterCreature']);
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: /^Monster/ })); });
    await waitFor(() => expect(writer.patches().at(-1)).toEqual(
      { op: 'set', path: ['atlas-template'], base: undefined, next: 'builtin:generic-creature' },
    ));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('without the plugin', () => {
  it('edits a frontmatter statblock right here with the auto template, and offers Save as a template', async () => {
    fs.on = false;
    const { result } = await pane({ frontmatter: GOBLIN });
    expect(screen.queryByTestId('fs-statblock')).toBeNull();
    expect(screen.getByText('Shown with Atlas\' field layout')).toBeTruthy();
    expect(editableBlocks(result.container)).toBeGreaterThan(0);
    fireEvent.keyDown(screen.getByRole('button', { name: 'More statblock actions' }), { key: 'Enter' });
    expect(await screen.findByRole('menuitem', { name: 'Save as a template' })).toBeTruthy();
  });

  it('shows the statblock in the plugin\'s look once the plugin loads after the pane', async () => {
    fs.on = false;
    const { app } = await pane({ frontmatter: GOBLIN });
    expect(screen.getByText('Shown with Atlas\' field layout')).toBeTruthy();
    fs.on = true;
    const listeners = vi.mocked(app.workspace.on).mock.calls.filter(([event]) => String(event) === 'fantasy-statblocks:loaded');
    expect(listeners.length).toBeGreaterThan(0);
    act(() => { for (const [, listener] of listeners) (listener as () => void)(); });
    expect(await screen.findByText('Made with Fantasy Statblocks')).toBeTruthy();
    expect(screen.getByTestId('fs-statblock')).toBeTruthy();
  });
});

describe('a fence statblock', () => {
  it('shows read-only with Copy into a new statblock, which copies it with the collection\'s role', async () => {
    await pane({ frontmatter: { name: 'Fen hag' }, files: { [NOTE_PATH]: '---\nname: Fen hag\n---\n```statblock\nname: Fen hag\nhp: 9\n```\n' } });
    expect(await screen.findByTestId('fs-statblock')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Copy into a new statblock' }));
    expect(copyFenceIntoStatblock).toHaveBeenCalledWith(expect.anything(), NOTE_PATH, 'campaign', 'monster');
  });
});
