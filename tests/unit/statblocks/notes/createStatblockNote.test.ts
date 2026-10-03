import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsService } from '../../../../src/app/services/SettingsService';
import { TokenStatblockLinkService } from '../../../../src/app/services/TokenStatblockLinkService';
import { createStatblockNote, noteFileName, statblockNoteText } from '../../../../src/app/statblocks/notes/createStatblockNote';
import { statblockSourceFromText } from '../../../../src/app/statblocks/notes/statblockSource';
import { noteHarness } from './noteHarness';

// The link service is tested on its own; its imports reach the canvas renderer.
vi.mock('../../../../src/app/services/TokenStatblockLinkService', () => ({ TokenStatblockLinkService: { getInstance: vi.fn() } }));

const TEMPLATE = 'builtin:generic-creature';

function linkService(): { linkTokenToStatblock: ReturnType<typeof vi.fn> } {
  const service = { linkTokenToStatblock: vi.fn(async () => true) };
  vi.mocked(TokenStatblockLinkService.getInstance).mockReturnValue(service as unknown as TokenStatblockLinkService);
  return service;
}

function showFence(on: boolean): void {
  vi.spyOn(SettingsService, 'forApp').mockReturnValue({ getSetting: () => on } as unknown as SettingsService);
}

afterEach(() => { vi.restoreAllMocks(); });

describe('statblockNoteText', () => {
  it('marks a native statblock with its template, name and token art, and the note fence on top of the body', () => {
    const text = statblockNoteText({ name: 'Marsh Warden', templateId: TEMPLATE, tokenImagePath: 'art/warden.webp' }, true);

    expect(text).toBe('---\nstatblock: true\natlas-template: builtin:generic-creature\nname: Marsh Warden\nimage: art/warden.webp\n---\n```atlas-statblock\n```\n');
    expect(statblockSourceFromText(text)).toEqual({ kind: 'atlas', templateId: TEMPLATE });
  });

  it('quotes a name YAML would read as something else, and leaves the fence out when asked', () => {
    const text = statblockNoteText({ name: 'Yes: no #1', templateId: TEMPLATE }, false);

    expect(text.endsWith('---\n')).toBe(true);
    expect(text).not.toContain('atlas-statblock');
    expect(text).toContain('name: "Yes: no #1"');
  });
});

describe('noteFileName', () => {
  it('replaces what a file name cannot carry', () => {
    expect(noteFileName(' Orc: chief [elite] ')).toBe('Orc- chief -elite-');
    expect(noteFileName('.hidden')).toBe('hidden');
    expect(noteFileName('   ')).toBe('New statblock');
  });
});

describe('createStatblockNote', () => {
  it('creates the note in the role folder, numbering a taken name in any letter case', async () => {
    showFence(true);
    linkService();
    const harness = noteHarness({ 'Bestiary/Goblin.md': 'taken', 'Bestiary/goblin 2.md': 'taken' });

    const { file, linked } = await createStatblockNote(harness.app, { name: 'Goblin', templateId: TEMPLATE, folder: 'Bestiary' });

    expect(file.path).toBe('Bestiary/Goblin 3.md');
    expect(linked).toBe(false);
    expect(harness.files.get('Bestiary/Goblin 3.md')).toContain('```atlas-statblock');
  });

  it('creates a missing role folder, and uses Obsidian\'s folder for new notes without one', async () => {
    showFence(false);
    linkService();
    const harness = noteHarness({});

    expect((await createStatblockNote(harness.app, { name: 'Wolf', templateId: TEMPLATE, folder: 'World/Beasts' })).file.path).toBe('World/Beasts/Wolf.md');
    expect((await createStatblockNote(harness.app, { name: 'Bear', templateId: TEMPLATE })).file.path).toBe('Bear.md');
    expect(harness.folders.has('World/Beasts')).toBe(true);
    expect(harness.files.get('Bear.md')).not.toContain('atlas-statblock');
  });

  it('writes the token\'s art and links the token to the new note', async () => {
    showFence(true);
    const service = linkService();
    const harness = noteHarness({});

    const { file, linked } = await createStatblockNote(harness.app, { name: 'Warden', templateId: TEMPLATE, folder: 'Bestiary', tokenImagePath: 'art/warden.webp' });

    expect(linked).toBe(true);
    expect(harness.files.get(file.path)).toContain('image: art/warden.webp');
    expect(service.linkTokenToStatblock).toHaveBeenCalledWith('art/warden.webp', 'Bestiary/Warden.md', { showConfirmation: false });
  });
});
