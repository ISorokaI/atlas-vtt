import type { App } from 'obsidian';
import { COLLECTIONS_DIR } from '../services/assetPaths';
import type { AssetService, SceneAsset } from '../services/AssetService';
import { ensureFolder } from '../plugin/vaultFolders';
import { listHiddenFiles, removeEmptyHiddenFolders, trashHiddenPath } from '../utils/hiddenVaultFiles';
import { baseName, parentPath } from '../utils/pathUtils';
import { isScenePath } from '../utils/sceneFiles';
import { snapshotFolderOf } from './sceneSnapshotFolders';
import { LEGACY_SNAPSHOTS_DIR } from './snapshotPaths';

/** Set on this device once its hidden snapshot folders were carried over. Never synced: every device has its own. */
export const SNAPSHOT_MIGRATION_KEY = 'atlas-vtt-snapshots-in-collections';
const DONE = 1;

/** What a legacy snapshot folder may hold that Atlas wrote: the snapshot and its thumbnail. */
const SNAPSHOT_FILE = /\.(json|jpg)$/;

export interface SnapshotMigrationResult {
  /** Snapshot files written to their scene's new folder. */
  moved: number;
  /** Snapshot files another device had carried over already; the local copy was dropped. */
  duplicates: number;
  /** Hidden folders whose scene was not found; they stay where they are. */
  leftovers: string[];
}

/**
 * The folders that may hold a `.snapshots` folder: every folder with a scene
 * map in it, and every folder of a collection that has one.
 */
async function legacyParents(app: App): Promise<Set<string>> {
  const parents = new Set(app.vault.getFiles().filter((file) => isScenePath(file.path)).map((file) => parentPath(file.path)));
  for (const path of await listHiddenFiles(app, COLLECTIONS_DIR)) {
    const segments = path.split('/');
    const hidden = segments.lastIndexOf(LEGACY_SNAPSHOTS_DIR);
    if (hidden > 0 && hidden === segments.length - 3) parents.add(segments.slice(0, hidden).join('/'));
  }
  return parents;
}

/** Copies the snapshot files of one hidden folder to `target` and drops the local copies once they are there. */
async function migrateFolder(app: App, legacy: string, target: string, result: SnapshotMigrationResult): Promise<void> {
  const { adapter } = app.vault;
  const files = (await adapter.list(legacy)).files.filter((path) => SNAPSHOT_FILE.test(path));
  const carried: string[] = [];
  for (const path of files) {
    const destination = `${target}/${baseName(path)}`;
    if (await adapter.exists(destination)) {
      // Another device carried this snapshot over and sync brought it here: its copy is the one to keep.
      result.duplicates += 1;
    } else {
      await ensureFolder(app, target);
      await app.vault.createBinary(destination, await adapter.readBinary(path));
      result.moved += 1;
    }
    carried.push(path);
  }
  for (const path of carried) {
    if (await adapter.exists(`${target}/${baseName(path)}`)) await trashHiddenPath(app, path);
  }
  await removeEmptyHiddenFolders(app, legacy, parentPath(parentPath(legacy)));
}

/**
 * Carries the snapshots earlier versions kept beside each map, in a hidden
 * folder sync tools skip (`<folder>/.snapshots/<scene>/`), over to the
 * collection folder of their scene (`snapshots/<scene id>/`), through the vault
 * so sync tools see them. Runs once per device and is safe to repeat: a
 * snapshot already at its new place is kept and the local copy dropped. A
 * folder whose scene is not found stays where it is.
 */
export async function migrateLegacySnapshots(app: App, assets: AssetService): Promise<SnapshotMigrationResult | null> {
  if (app.loadLocalStorage(SNAPSHOT_MIGRATION_KEY) === DONE) return null;
  await assets.initialize();
  const scenes = new Map<string, SceneAsset>();
  for (const scene of await assets.getAssets(undefined, 'scene')) {
    if (scene.data?.mapPath) scenes.set(scene.data.mapPath, scene);
  }

  const result: SnapshotMigrationResult = { moved: 0, duplicates: 0, leftovers: [] };
  for (const parent of await legacyParents(app)) {
    const root = `${parent ? `${parent}/` : ''}${LEGACY_SNAPSHOTS_DIR}`;
    if (!(await app.vault.adapter.exists(root))) continue;
    for (const legacy of (await app.vault.adapter.list(root)).folders) {
      const scene = scenes.get(`${parent ? `${parent}/` : ''}${baseName(legacy)}.atlasmap`);
      if (scene) await migrateFolder(app, legacy, snapshotFolderOf(scene), result);
      else result.leftovers.push(legacy);
    }
  }

  if (result.leftovers.length > 0) {
    console.warn('[Atlas] These snapshot folders belong to no scene of a collection and stay where they are:', result.leftovers);
  }
  app.saveLocalStorage(SNAPSHOT_MIGRATION_KEY, DONE);
  return result;
}
