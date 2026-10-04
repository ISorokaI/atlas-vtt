import { afterEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { BUILT_IN_SYSTEM_PRESETS } from '../../src/app/gameSystems/builtInPresets';
import { SETTINGS_MIGRATED_KEY, migrateSettingsToPluginData } from '../../src/app/plugin/settingsMigration';
import { INPUT_MODE_STORAGE_KEY } from '../../src/app/services/deviceSettings';
import { SettingsService } from '../../src/app/services/SettingsService';
import { SystemPresetService } from '../../src/app/services/SystemPresetService';
import { SystemPresetFiles } from '../../src/app/services/systemPresets/SystemPresetFiles';
import { SYSTEM_PRESET_FOLDER } from '../../src/app/services/systemPresets/presetFiles';
import { createInMemoryApp } from '../mocks/inMemoryVault';
import { memoryPluginData } from '../mocks/pluginData';

const HIDDEN_SETTINGS = 'atlas-vtt/.atlas-data/settings.json';
const LEGACY_SETTINGS = 'atlas-vtt/settings.json';
const rules = structuredClone(BUILT_IN_SYSTEM_PRESETS[1]!.rules);
const homebrew = { id: 'p1', name: 'Homebrew', builtIn: false, rules };
const fen = { id: 'p2', name: 'Fen', builtIn: false, rules };

const opened: App[] = [];

/** A device: its vault, its plugin data and its preset files, as Atlas starts them. */
function device(files: Record<string, string> = {}, data: unknown = null): {
  app: App;
  files: Map<string, string>;
  data: ReturnType<typeof memoryPluginData>;
  presets: SystemPresetFiles;
  migrate: () => Promise<void>;
} {
  const vault = createInMemoryApp({ files });
  const plugin = memoryPluginData(data);
  const presets = SystemPresetFiles.open(vault.app);
  opened.push(vault.app);
  return { ...vault, data: plugin, presets, migrate: () => migrateSettingsToPluginData(vault.app, plugin, presets) };
}

const presetFiles = (files: Map<string, string>): string[] => [...files.keys()].filter((path) => path.startsWith(`${SYSTEM_PRESET_FOLDER}/`)).sort();

afterEach(() => {
  for (const app of opened.splice(0)) SystemPresetFiles.release(app);
  vi.restoreAllMocks();
});

describe('carrying the settings over into the plugin data', () => {
  it('moves preferences, input mode and presets out of the old settings file and leaves the file in place', async () => {
    const old = JSON.stringify({ diceColour: 'dark', hotkeys: { assets: 'q' }, navigation: { inputMode: 'mouse' }, systemPresets: [homebrew, fen], futureKey: 1 });
    const { app, files, data, presets, migrate } = device({ [HIDDEN_SETTINGS]: old });
    await migrate();

    expect(data.stored()).toEqual({ diceColour: 'dark', hotkeys: { assets: 'q' }, futureKey: 1 });
    expect(app.loadLocalStorage(INPUT_MODE_STORAGE_KEY)).toBe('mouse');
    expect(presetFiles(files)).toEqual([`${SYSTEM_PRESET_FOLDER}/Fen.json`, `${SYSTEM_PRESET_FOLDER}/Homebrew.json`]);
    expect(new SystemPresetService(presets).list().find((preset) => preset.id === 'p1')).toMatchObject({ name: 'Homebrew' });
    expect(files.get(HIDDEN_SETTINGS)).toBe(old);
    expect(app.loadLocalStorage(SETTINGS_MIGRATED_KEY)).toBe(true);

    const settings = new SettingsService(app, undefined, data);
    await settings.initialize();
    expect(settings.getDiceLook().colour).toBe('dark');
    expect(settings.getHotkeys().assets).toBe('q');
    expect(settings.getNavigationSettings().inputMode).toBe('mouse');
  });

  it('reads the settings file of the oldest versions too', async () => {
    const { data, files, migrate } = device({ [LEGACY_SETTINGS]: JSON.stringify({ diceDisplay: 'card', systemPresets: [homebrew] }) });
    await migrate();
    expect(data.stored()).toEqual({ diceDisplay: 'card' });
    expect(presetFiles(files)).toEqual([`${SYSTEM_PRESET_FOLDER}/Homebrew.json`]);
  });

  it('starts a fresh vault with nothing to carry over', async () => {
    const { app, data, files, migrate } = device();
    await migrate();
    expect(data.saveData).not.toHaveBeenCalled();
    expect(presetFiles(files)).toEqual([]);
    expect(app.loadLocalStorage(SETTINGS_MIGRATED_KEY)).toBe(true);
  });

  it('does nothing on a device that was migrated already', async () => {
    const { app, data, files, migrate } = device({ [HIDDEN_SETTINGS]: JSON.stringify({ diceColour: 'dark', systemPresets: [homebrew] }) });
    app.saveLocalStorage(SETTINGS_MIGRATED_KEY, true);
    await migrate();
    expect(data.loadData).not.toHaveBeenCalled();
    expect(data.saveData).not.toHaveBeenCalled();
    expect(presetFiles(files)).toEqual([]);
  });

  it('keeps the settings another device put into the plugin data, and adds only the presets no file holds', async () => {
    const synced = { diceColour: 'accent', hotkeys: { help: 'h' } };
    const { app, data, files, migrate } = device({
      [HIDDEN_SETTINGS]: JSON.stringify({ diceColour: 'dark', navigation: { inputMode: 'trackpad' }, systemPresets: [{ ...homebrew, name: 'Old name' }, fen] }),
      [`${SYSTEM_PRESET_FOLDER}/Homebrew.json`]: `${JSON.stringify({ format: 1, ...homebrew }, null, 2)}\n`,
    }, synced);
    await migrate();
    expect(data.stored()).toEqual(synced);
    expect(data.saveData).not.toHaveBeenCalled();
    expect(app.loadLocalStorage(INPUT_MODE_STORAGE_KEY)).toBe('trackpad');
    expect(presetFiles(files)).toEqual([`${SYSTEM_PRESET_FOLDER}/Fen.json`, `${SYSTEM_PRESET_FOLDER}/Homebrew.json`]);
    expect(JSON.parse(files.get(`${SYSTEM_PRESET_FOLDER}/Homebrew.json`)!)).toMatchObject({ name: 'Homebrew' });
  });

  it('keeps an input mode this device chose already', async () => {
    const { app, migrate } = device({ [HIDDEN_SETTINGS]: JSON.stringify({ navigation: { inputMode: 'mouse' } }) });
    app.saveLocalStorage(INPUT_MODE_STORAGE_KEY, 'trackpad');
    await migrate();
    expect(app.loadLocalStorage(INPUT_MODE_STORAGE_KEY)).toBe('trackpad');
  });

  it('turns presets left in the plugin data into files and takes them out of it', async () => {
    const { data, files, migrate } = device({}, { diceColour: 'dark', systemPresets: [fen] });
    await migrate();
    expect(presetFiles(files)).toEqual([`${SYSTEM_PRESET_FOLDER}/Fen.json`]);
    expect(data.stored()).toEqual({ diceColour: 'dark' });
  });

  it('changes nothing when it runs again', async () => {
    const { app, data, files, migrate } = device({ [HIDDEN_SETTINGS]: JSON.stringify({ diceColour: 'dark', systemPresets: [homebrew] }) });
    await migrate();
    const before = { data: data.stored(), files: new Map(files) };
    app.saveLocalStorage(SETTINGS_MIGRATED_KEY, null);
    vi.mocked(data.saveData).mockClear();
    await migrate();
    expect(data.saveData).not.toHaveBeenCalled();
    expect(data.stored()).toEqual(before.data);
    expect(files).toEqual(before.files);
  });

  it('tries again at the next start when a preset file could not be written', async () => {
    const { app, files, migrate } = device({ [HIDDEN_SETTINGS]: JSON.stringify({ systemPresets: [homebrew] }) });
    vi.mocked(app.vault.create).mockRejectedValueOnce(new Error('disk full'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(migrate()).rejects.toThrow(/could not be written/);
    expect(app.loadLocalStorage(SETTINGS_MIGRATED_KEY)).toBeNull();
    expect(presetFiles(files)).toEqual([]);

    SystemPresetFiles.release(app);
    await migrateSettingsToPluginData(app, memoryPluginData(), SystemPresetFiles.open(app));
    expect(presetFiles(files)).toEqual([`${SYSTEM_PRESET_FOLDER}/Homebrew.json`]);
    expect(app.loadLocalStorage(SETTINGS_MIGRATED_KEY)).toBe(true);
  });
});
