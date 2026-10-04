import React from 'react';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { TemplateLibrary } from '../../../../src/app/statblocks/library/TemplateLibrary';
import { GENERIC_CREATURE } from '../../../../src/app/statblocks/presets/generic';
import { NOTE_PATH, renderPane, type PaneHarness, type PaneOptions } from './paneKit';

vi.mock('../../../../src/app/services/AssetService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../src/app/services/AssetService')>();
  const assets = {
    getCollections: async () => [{ id: 'campaign', name: 'Campaign' }],
    getAssets: async () => [],
    getDefaultCollectionId: () => 'campaign',
    getCollectionSettings: () => ({
      conditions: [],
      statblockRoles: [{ id: 'monster', name: 'Monster', templateId: 'builtin:generic-creature' }],
    }),
  };
  return { ...actual, AssetService: { getInstance: () => assets } };
});

// The read-only Fantasy Statblocks look is LinkedStatblock's own; here it only has to be there.
vi.mock('../../../../src/app/statblocks/render/LinkedStatblock', () => ({
  LinkedStatblock: ({ path }: { path: string }) => <div data-testid="fs-statblock">{path}</div>,
}));

const apps: App[] = [];
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  for (const app of apps.splice(0)) TemplateLibrary.release(app);
});

const NATIVE = { statblock: true, 'atlas-template': 'builtin:generic-creature', name: 'Marsh Warden', hp: 14 };

async function pane(options: PaneOptions): Promise<PaneHarness> {
  const harness = await renderPane(options);
  apps.push(harness.app);
  await waitFor(() => expect(TemplateLibrary.forApp(harness.app).isLoading()).toBe(false));
  return harness;
}

const editableBlocks = (container: HTMLElement): number => container.querySelectorAll('.atlas-sb-pane-value').length;

describe('the statblock pane\'s edge states', () => {
  it('draws a note whose template is missing with the auto template, and offers to choose one', async () => {
    const { result, writer } = await pane({ frontmatter: { ...NATIVE, 'atlas-template': 'marsh-creature-k7m2qa' } });
    expect(screen.getByText('marsh-creature-k7m2qa').closest('.atlas-sb-pane-bar')?.textContent).toBe('Template marsh-creature-k7m2qa not foundChoose a template');
    expect(result.container.querySelector('[data-template="auto"]')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Choose a template' }));
    const dialog = screen.getByRole('dialog', { name: 'Change template' });
    expect(dialog).toBeTruthy();
    fireEvent.click(screen.getAllByRole('option', { name: /Creature/ })[0]!);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Apply' })); });
    expect(writer.patches()).toEqual([
      { op: 'set', path: ['atlas-template'], base: 'marsh-creature-k7m2qa', next: 'builtin:generic-creature' },
    ]);
  });

  it('keeps values editable with a template of a newer Atlas, and locks the template', async () => {
    vi.spyOn(TemplateLibrary.prototype, 'get').mockReturnValue({
      template: GENERIC_CREATURE.template, name: 'Marsh creature', status: 'newer', builtIn: false, path: 'Templates/Marsh creature.atlastemplate',
    });
    const { result } = await pane({ frontmatter: { ...NATIVE, 'atlas-template': 'marsh-creature-k7m2qa' } });
    expect(screen.getByText('Update Atlas to edit this template')).toBeTruthy();
    expect(result.container.querySelector('.atlas-sb-pane-template__lock')).not.toBeNull();
    expect(editableBlocks(result.container)).toBeGreaterThan(0);
  });

  it('shows a Fantasy Statblocks statblock read-only while the plugin is on, offering an Atlas template, and Open note once unpaired', async () => {
    Object.assign(window, { FantasyStatblocks: {} });
    try {
      const { result, actions, rerender } = await pane({ frontmatter: { statblock: true, name: 'Goblin' } });
      expect(screen.getByTestId('fs-statblock').textContent).toBe(NOTE_PATH);
      expect(editableBlocks(result.container)).toBe(0);
      expect(screen.getByRole('button', { name: 'Edit with an Atlas template' })).toBeTruthy();
      rerender({ paired: false });
      fireEvent.click(screen.getByRole('button', { name: 'Open note' }));
      expect(actions.openNote).toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(window, 'FantasyStatblocks');
    }
  });

  it('offers to create a statblock in a note without one', async () => {
    const createStatblock = vi.fn();
    await pane({
      frontmatter: { name: 'Just a note' },
      files: { [NOTE_PATH]: '---\nname: Just a note\n---\nNo fence here.\n' },
      actions: { openNote: vi.fn(), openInNewWindow: vi.fn(), showProperties: vi.fn(), changeCollection: vi.fn(), reportKind: vi.fn(), createStatblock },
    });
    await screen.findByText('No statblock in this note');
    fireEvent.click(screen.getByRole('button', { name: 'Create statblock' }));
    expect(createStatblock).toHaveBeenCalledWith(NOTE_PATH, 'monster', 'campaign');
  });

  it('never writes into properties Obsidian cannot read', async () => {
    const { result } = await pane({ frontmatter: null, problem: { line: 3, message: 'Bad indentation' } });
    expect(screen.getByText('The note\'s properties can\'t be read (line 3)')).toBeTruthy();
    expect(editableBlocks(result.container)).toBe(0);
  });

  it('turns read-only when the partner closed, and offers Open note', async () => {
    const { result, actions } = await pane({ frontmatter: NATIVE, paired: false });
    expect(screen.getByText('Open the note to edit')).toBeTruthy();
    expect(editableBlocks(result.container)).toBe(0);
    expect(screen.queryByRole('button', { name: /More properties/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open note' }));
    expect(actions.openNote).toHaveBeenCalled();
  });

  it('keeps what a deleted note held on screen, read-only', async () => {
    const harness = await pane({ frontmatter: NATIVE });
    const files = harness.app.vault as unknown as { getAbstractFileByPath: (path: string) => unknown };
    files.getAbstractFileByPath = () => null;
    act(() => harness.source.remove(NOTE_PATH));
    expect(screen.getByText(/Note deleted/)).toBeTruthy();
    expect(harness.result.container.querySelector('[data-block-id="gctitle0"]')?.textContent).toBe('Marsh Warden');
    expect(editableBlocks(harness.result.container)).toBe(0);
    expect(harness.actions.reportKind).toHaveBeenLastCalledWith('deleted');
  });

  it('tells its view what the note is', async () => {
    const { actions } = await pane({ frontmatter: NATIVE });
    expect(actions.reportKind).toHaveBeenLastCalledWith('atlas');
  });
});
