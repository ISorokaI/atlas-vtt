import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { AssetService } from '../../../../src/app/services/AssetService';
import { TemplateLibrary } from '../../../../src/app/statblocks/library/TemplateLibrary';
import { NoteFieldWriter } from '../../../../src/app/statblocks/notes/NoteFieldWriter';
import { frontmatterOfText, statblockSourceFromText } from '../../../../src/app/statblocks/notes/statblockSource';
import { makeNoteAStatblock, paneCreationActions, statblockMarkPatches } from '../../../../src/app/statblocks/editor/create/paneCreation';
import { withStatblockEditor } from '../../../mocks/experimentalFeatures';
import { noteHarness, type NoteHarness } from '../notes/noteHarness';

let harness: NoteHarness;
const app = (): App => harness.app as unknown as App;

beforeEach(() => {
  harness = noteHarness({
    'Notes/Bog Hag.md': '---\ntags:\n  - swamp\n---\nShe lives in the reeds.\n',
    'Notes/Mayor.md': '---\nname: Mayor Alys\n---\n',
    'Notes/Plain.md': 'Just text.\n',
    'Notes/Broken.md': '---\nname: [unclosed\n---\n',
  });
  vi.spyOn(AssetService, 'getInstance').mockReturnValue({
    getDefaultCollectionId: () => 'default',
    getCollectionSettings: () => ({ conditions: [] }),
  } as unknown as AssetService);
});

afterEach(() => {
  NoteFieldWriter.release(app());
  TemplateLibrary.release(app());
  vi.restoreAllMocks();
});

describe('Create statblock in the pane, on a note without one', () => {
  it('marks the note with the role\'s template and names it after the note, keeping the rest', async () => {
    withStatblockEditor(app());
    expect(await makeNoteAStatblock(app(), 'Notes/Bog Hag.md', 'creature', 'marsh')).toBe(true);

    const text = harness.files.get('Notes/Bog Hag.md')!;
    expect(frontmatterOfText(text)).toEqual({ tags: ['swamp'], statblock: true, 'atlas-template': 'builtin:generic-creature', name: 'Bog Hag' });
    expect(text.endsWith('---\nShe lives in the reeds.\n')).toBe(true);
    expect(statblockSourceFromText(text)).toEqual({ kind: 'atlas', templateId: 'builtin:generic-creature' });
  });

  it('keeps a name the note has, and gives a note without properties its first ones', async () => {
    withStatblockEditor(app());
    await makeNoteAStatblock(app(), 'Notes/Mayor.md', 'npc', 'marsh');
    await makeNoteAStatblock(app(), 'Notes/Plain.md', 'npc', 'marsh');

    expect(frontmatterOfText(harness.files.get('Notes/Mayor.md')!)).toEqual({ name: 'Mayor Alys', statblock: true, 'atlas-template': 'builtin:generic-npc' });
    expect(frontmatterOfText(harness.files.get('Notes/Plain.md')!)).toEqual({ statblock: true, 'atlas-template': 'builtin:generic-npc', name: 'Plain' });
  });

  it('never writes into properties it cannot read, nor while the switch is off', async () => {
    expect(await makeNoteAStatblock(app(), 'Notes/Bog Hag.md', 'creature', 'marsh')).toBe(false);
    withStatblockEditor(app());
    expect(await makeNoteAStatblock(app(), 'Notes/Broken.md', 'creature', 'marsh')).toBe(false);
    expect(harness.files.get('Notes/Broken.md')).toBe('---\nname: [unclosed\n---\n');
    expect(harness.files.get('Notes/Bog Hag.md')).not.toContain('statblock');
    expect(() => statblockMarkPatches(null, 'builtin:generic-creature', 'X')).toThrow();
  });

  it('is the action the plugin hands the pane', async () => {
    withStatblockEditor(app());
    paneCreationActions(app()).createStatblock?.('Notes/Bog Hag.md', 'creature', 'marsh');
    await vi.waitFor(() => expect(harness.files.get('Notes/Bog Hag.md')).toContain('statblock: true'));
  });
});
