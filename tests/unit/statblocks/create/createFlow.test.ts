import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { AssetService } from '../../../../src/app/services/AssetService';
import { SettingsService } from '../../../../src/app/services/SettingsService';
import { TokenStatblockLinkService } from '../../../../src/app/services/TokenStatblockLinkService';
import { TemplateLibrary } from '../../../../src/app/statblocks/library/TemplateLibrary';
import { frontmatterOfText, statblockSourceFromText } from '../../../../src/app/statblocks/notes/statblockSource';
import { createStatblock, startStatblockCreation } from '../../../../src/app/statblocks/editor/create/createFlow';
import { promptStatblockCreation } from '../../../../src/app/statblocks/editor/create/CreationPrompt';
import { openStatblockEditor } from '../../../../src/app/statblocks/editor/openStatblockEditor';
import type { CollectionSettings } from '../../../../src/app/types/collectionSettingsTypes';
import { noteHarness, type NoteHarness } from '../notes/noteHarness';

// The link service is tested on its own; its imports reach the canvas renderer.
vi.mock('../../../../src/app/services/TokenStatblockLinkService', () => ({ TokenStatblockLinkService: { getInstance: vi.fn() } }));
vi.mock('../../../../src/app/statblocks/editor/openStatblockEditor', () => ({ openStatblockEditor: vi.fn(async () => undefined) }));
vi.mock('../../../../src/app/statblocks/editor/create/CreationPrompt', () => ({ promptStatblockCreation: vi.fn() }));

const MARSH: CollectionSettings = {
  conditions: [],
  statblockRoles: [
    { id: 'monster', name: 'Monster', templateId: 'builtin:generic-creature' },
    { id: 'beast', name: 'Beast', templateId: 'gone-aaaaaa' },
    { id: 'npc', name: 'NPC', templateId: 'builtin:generic-npc' },
  ],
  statblockRoleFolders: { monster: 'Bestiary' },
};

let harness: NoteHarness;
let link: ReturnType<typeof vi.fn>;

/** Atlas' settings as these tests need them: the switch, and the fence setting. */
function settings({ editor = true, fence = true } = {}): void {
  vi.spyOn(SettingsService, 'forApp').mockReturnValue({
    getSetting: (key: string) => (key === 'showStatblocksInNotes' ? fence : undefined),
    isExperimentalOn: () => editor,
    onChange: () => () => undefined,
  } as unknown as SettingsService);
}

beforeEach(() => {
  harness = noteHarness({});
  settings();
  link = vi.fn(async () => true);
  vi.mocked(TokenStatblockLinkService.getInstance).mockReturnValue({ linkTokenToStatblock: link } as unknown as TokenStatblockLinkService);
  vi.spyOn(AssetService, 'getInstance').mockReturnValue({
    getDefaultCollectionId: () => 'default',
    getCollectionSettings: (id: string) => (id === 'marsh' ? MARSH : { conditions: [] }),
    getCollections: async () => [{ id: 'default', name: 'Default' }, { id: 'marsh', name: 'Marsh campaign' }],
  } as unknown as AssetService);
});

afterEach(() => {
  TemplateLibrary.release(harness.app as unknown as App);
  vi.restoreAllMocks();
  vi.mocked(openStatblockEditor).mockClear();
  vi.mocked(promptStatblockCreation).mockReset();
});

const app = (): App => harness.app as unknown as App;

describe('creating a statblock for a token', () => {
  it('writes exactly the marker, the template, the name and the art, with the note fence, in the role\'s folder', async () => {
    const onLinked = vi.fn();
    const path = await createStatblock(app(), {
      collectionId: 'marsh', roleId: 'monster', name: 'Marsh Warden', tokenImagePath: 'art/warden.webp', from: 'map', onLinked,
    });

    expect(path).toBe('Bestiary/Marsh Warden.md');
    const text = harness.files.get('Bestiary/Marsh Warden.md')!;
    expect(frontmatterOfText(text)).toEqual({
      statblock: true, 'atlas-template': 'builtin:generic-creature', name: 'Marsh Warden', image: 'art/warden.webp',
    });
    expect(text.endsWith('---\n```atlas-statblock\n```\n')).toBe(true);
    expect(statblockSourceFromText(text)).toEqual({ kind: 'atlas', templateId: 'builtin:generic-creature' });
  });

  it('links the token, then opens the pair for the entry point\'s collection', async () => {
    const onLinked = vi.fn();
    await createStatblock(app(), {
      collectionId: 'marsh', roleId: 'monster', name: 'Marsh Warden', tokenImagePath: 'art/warden.webp', from: 'map', onLinked,
    });

    expect(link).toHaveBeenCalledWith('art/warden.webp', 'Bestiary/Marsh Warden.md', { showConfirmation: false });
    expect(onLinked).toHaveBeenCalledWith('Bestiary/Marsh Warden.md');
    expect(openStatblockEditor).toHaveBeenCalledWith(app(), { notePath: 'Bestiary/Marsh Warden.md', collectionId: 'marsh', from: 'map' });
  });

  it('leaves the fence out when the setting is off, and starts a role whose template is missing from the generic one', async () => {
    settings({ fence: false });
    await createStatblock(app(), { collectionId: 'marsh', roleId: 'beast', name: 'Wolf', from: 'asset-manager' });

    const text = harness.files.get('Wolf.md')!;
    expect(text).not.toContain('atlas-statblock');
    expect(frontmatterOfText(text)).toEqual({ statblock: true, 'atlas-template': 'builtin:generic-creature', name: 'Wolf' });
    expect(link).not.toHaveBeenCalled();
  });

  it('uses the default collection where the entry point has none', async () => {
    await createStatblock(app(), { collectionId: null, roleId: 'npc', name: 'Mayor', from: 'map' });

    expect(frontmatterOfText(harness.files.get('Mayor.md')!)?.['atlas-template']).toBe('builtin:generic-npc');
    expect(openStatblockEditor).toHaveBeenCalledWith(app(), expect.objectContaining({ collectionId: 'default' }));
  });

  it('makes nothing while the switch is off', async () => {
    settings({ editor: false });
    expect(await createStatblock(app(), { collectionId: 'marsh', roleId: 'monster', name: 'Warden', from: 'map' })).toBeNull();
    expect(harness.files.size).toBe(0);
    expect(openStatblockEditor).not.toHaveBeenCalled();
  });

  it('says so and opens nothing when the note cannot be written', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    harness.app.vault.create = vi.fn(async () => { throw new Error('disk full'); });
    expect(await createStatblock(app(), { collectionId: 'marsh', roleId: 'monster', name: 'Warden', from: 'map' })).toBeNull();
    expect(openStatblockEditor).not.toHaveBeenCalled();
  });
});

describe('creating a statblock from a command or the file menu', () => {
  it('offers the collection when the entry point named none, and creates in the folder picked', async () => {
    vi.mocked(promptStatblockCreation).mockResolvedValue({ roleId: 'monster', collectionId: 'marsh', name: 'Bog Hag' });
    const path = await startStatblockCreation(app(), { collectionId: null, folder: 'World/Swamp', from: 'command' });

    expect(vi.mocked(promptStatblockCreation).mock.calls[0]![0]).toEqual(expect.objectContaining({
      collectionId: 'default', offersCollection: true, collections: [{ id: 'default', name: 'Default' }, { id: 'marsh', name: 'Marsh campaign' }],
    }));
    expect(path).toBe('World/Swamp/Bog Hag.md');
    expect(frontmatterOfText(harness.files.get(path!)!)).toEqual({ statblock: true, 'atlas-template': 'builtin:generic-creature', name: 'Bog Hag' });
    expect(openStatblockEditor).toHaveBeenCalledWith(app(), { notePath: path, collectionId: 'marsh', from: 'command' });
  });

  it('keeps a named collection without offering another, and makes nothing when the user backs out', async () => {
    vi.mocked(promptStatblockCreation).mockResolvedValue(null);
    expect(await startStatblockCreation(app(), { collectionId: 'marsh', from: 'command' })).toBeNull();

    expect(vi.mocked(promptStatblockCreation).mock.calls[0]![0]).toEqual(expect.objectContaining({ collectionId: 'marsh', offersCollection: false }));
    const roles = vi.mocked(promptStatblockCreation).mock.calls[0]![0].choicesOf('marsh').map((choice) => choice.name);
    expect(roles).toEqual(['Monster', 'Beast', 'NPC']);
    expect(harness.files.size).toBe(0);
  });
});
