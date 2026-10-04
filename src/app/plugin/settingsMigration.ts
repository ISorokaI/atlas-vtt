import type { App } from 'obsidian';
import { isRecord } from '../services/atlasSettings';
import { isInputMode, loadInputMode, saveInputMode } from '../services/deviceSettings';
import type { PluginDataStore } from '../services/SettingsService';
import { isStoredPreset } from '../services/systemPresets/presetFiles';
import type { SystemPresetFiles } from '../services/systemPresets/SystemPresetFiles';

/** Set in this device's local storage once its settings were carried over; never in a synced file. */
export const SETTINGS_MIGRATED_KEY = 'atlas-vtt:settings-in-plugin-data';

/**
 * Where Atlas kept its settings before: the hidden data folder, which Obsidian Sync skips, and
 * the older place beside it. The files stay where they are, for an older Atlas on the vault.
 */
const OLD_SETTINGS_PATHS = ['atlas-vtt/.atlas-data/settings.json', 'atlas-vtt/settings.json'];

/** Keys of the old settings that are no preferences: presets became files, the input mode a device fact. */
const MOVED_KEYS = ['systemPresets', 'navigation'];

type DeviceStorage = Pick<App, 'loadLocalStorage' | 'saveLocalStorage'>;

async function readOldSettings(app: App): Promise<Record<string, unknown> | null> {
  const { adapter } = app.vault;
  for (const path of OLD_SETTINGS_PATHS) {
    if (!(await adapter.exists(path))) continue;
    try {
      const parsed: unknown = JSON.parse(await adapter.read(path));
      return isRecord(parsed) ? parsed : null;
    } catch (error) {
      console.error(`[Atlas] The old settings in ${path} could not be read:`, error);
      return null;
    }
  }
  return null;
}

function preferencesOf(stored: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(stored).filter(([key]) => !MOVED_KEYS.includes(key)));
}

const presetsIn = (stored: Record<string, unknown> | null): unknown[] =>
  Array.isArray(stored?.systemPresets) ? stored.systemPresets : [];

function migrated(storage: DeviceStorage): boolean {
  try {
    return storage.loadLocalStorage(SETTINGS_MIGRATED_KEY) === true;
  } catch {
    return false;
  }
}

/**
 * Carries this device's settings over from the old settings file, once per device:
 * - the preferences into the plugin's data, unless it already holds settings (another device
 *   migrated first and sync delivered them; those are kept);
 * - the input mode into this device's local storage;
 * - every user preset of the old file, and of the plugin's data, into a preset file, unless a
 *   file already holds its id.
 * Idempotent: an interrupted run repeats at the next start, and repeating changes nothing.
 */
export async function migrateSettingsToPluginData(app: App, data: PluginDataStore, presets: SystemPresetFiles): Promise<void> {
  if (migrated(app)) return;
  const loaded: unknown = await data.loadData();
  const current = isRecord(loaded) && Object.keys(loaded).length > 0 ? loaded : null;
  const old = await readOldSettings(app);
  if (!current && old) await data.saveData(preferencesOf(old));

  const mode = isRecord(old?.navigation) ? old.navigation.inputMode : undefined;
  if (isInputMode(mode) && !loadInputMode(app)) saveInputMode(app, mode);

  await presets.load();
  const created: string[] = [];
  for (const entry of [...presetsIn(old), ...presetsIn(current)]) {
    if (!isStoredPreset(entry) || presets.pathOf(entry.id) !== null) continue;
    presets.create(entry);
    created.push(entry.id);
  }
  await presets.flush();
  const unwritten = created.filter((id) => {
    const path = presets.pathOf(id);
    return !path || !app.vault.getAbstractFileByPath(path);
  });
  if (unwritten.length > 0) throw new Error(`${unwritten.length} system preset file(s) could not be written; trying again at the next start`);
  // The presets live in their files now; a list left in the plugin's data would bring deleted ones back.
  if (current && 'systemPresets' in current) await data.saveData(preferencesOf(current));
  app.saveLocalStorage(SETTINGS_MIGRATED_KEY, true);
}
