import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { App, TFile } from 'obsidian';
import { editInStatblockPane } from '../../../../src/app/statblocks/editor/create/entryPoints';
import { openStatblockEditor } from '../../../../src/app/statblocks/editor/openStatblockEditor';
import { frontmatterOfText } from '../../../../src/app/statblocks/notes/statblockSource';
import { withStatblockEditor } from '../../../mocks/experimentalFeatures';
import { createInMemoryApp } from '../../../mocks/inMemoryVault';

vi.mock('../../../../src/app/statblocks/editor/openStatblockEditor', () => ({ openStatblockEditor: vi.fn(async () => undefined) }));

const FENCE = 'Bestiary/Fen hag.md';
const CODE = 'Notes/Script.md';
const INLINE = 'Bestiary/Bog.md';

let app: App;

beforeEach(() => {
  const vault = createInMemoryApp({
    files: {
      [FENCE]: 'She waits.\n\n```statblock\nname: Fen hag\n```\n',
      [CODE]: '```js\nconsole.log(1);\n```\n',
      [INLINE]: '---\nstatblock: inline\n---\n',
    },
  });
  app = vault.app;
  // Obsidian's cache knows a note's code blocks, not their language.
  app.metadataCache.getFileCache = vi.fn((file: TFile) => {
    const text = vault.files.get(file.path) ?? '';
    return { frontmatter: frontmatterOfText(text) ?? undefined, sections: text.includes('```') ? [{ type: 'code' }] : [] };
  }) as unknown as App['metadataCache']['getFileCache'];
  Object.assign(app.workspace, { openLinkText: vi.fn(async () => undefined) });
  withStatblockEditor(app);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(openStatblockEditor).mockClear();
});

describe('Edit statblock for a fence statblock (D9, M6)', () => {
  it('opens the pair once the note proves to hold a ```statblock fence', async () => {
    expect(editInStatblockPane(app, FENCE, { collectionId: 'marsh', from: 'asset-manager' })).toBe(true);
    await vi.waitFor(() => expect(openStatblockEditor).toHaveBeenCalledWith(app, { notePath: FENCE, collectionId: 'marsh', from: 'asset-manager' }));
  });

  it('opens a note whose code block is no statblock as before', async () => {
    expect(editInStatblockPane(app, CODE, { collectionId: null, from: 'map' })).toBe(true);
    await vi.waitFor(() => expect(app.workspace.openLinkText).toHaveBeenCalledWith(CODE, '', true));
    expect(openStatblockEditor).not.toHaveBeenCalled();
  });

  it('opens the pair at once for statblock: inline', () => {
    expect(editInStatblockPane(app, INLINE, { collectionId: null, from: 'map' })).toBe(true);
    expect(openStatblockEditor).toHaveBeenCalledWith(app, { notePath: INLINE, collectionId: null, from: 'map' });
  });
});
