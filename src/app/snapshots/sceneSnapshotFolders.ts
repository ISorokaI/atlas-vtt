import { TFile, TFolder, type App } from 'obsidian';
import type { AssetService, SceneAsset } from '../services/AssetService';
import { trashVaultItem } from '../utils/trashVaultItem';
import { SceneSnapshotService } from './SceneSnapshotService';
import { collectionSnapshotsFolder, isSnapshotJsonPath, parentFolderOf, sceneSnapshotFolder } from './snapshotPaths';
import { COLLECTIONS_DIR } from '../services/assetPaths';
import { ensureFolder } from '../plugin/vaultFolders';

type SceneKey = Pick<SceneAsset, 'id' | 'collection'>;

/** The folder holding the snapshots of `scene`. */
export const snapshotFolderOf = (scene: SceneKey): string => sceneSnapshotFolder(scene.collection, scene.id);

/** The scene record whose map is the file at `mapPath`, or null when the map belongs to no scene. */
export async function sceneOfMap(assets: AssetService, mapPath: string): Promise<SceneAsset | null> {
  return (await assets.getAssets(undefined, 'scene')).find((scene) => scene.data?.mapPath === mapPath) ?? null;
}

/**
 * The snapshot folder of the scene whose map is `mapPath`. A map that belongs
 * to no scene (an `.atlasmap` placed outside every collection by hand) has
 * none: snapshots belong to a scene record and are keyed by its id.
 */
export async function snapshotFolderForMap(assets: AssetService, mapPath: string): Promise<string | null> {
  const scene = await sceneOfMap(assets, mapPath);
  return scene ? snapshotFolderOf(scene) : null;
}

/** Moves a deleted scene's snapshots to the trash. */
export async function trashSceneSnapshots(app: App, scene: SceneKey): Promise<void> {
  const folder = app.vault.getFolderByPath(snapshotFolderOf(scene));
  if (folder) await trashVaultItem(app, folder);
}

/**
 * Moves the snapshots of scenes whose collection changed outside Atlas (a map
 * dragged into another collection's folder) to their collection's folder, so
 * they stay with the scene. A scene whose folder is in place is left alone.
 */
export async function followSceneSnapshots(app: App, scenes: readonly SceneKey[]): Promise<void> {
  const collections = (app.vault.getFolderByPath(COLLECTIONS_DIR)?.children ?? []).filter((child) => child instanceof TFolder);
  for (const scene of scenes) {
    const target = snapshotFolderOf(scene);
    if (app.vault.getFolderByPath(target)) continue;
    const found = collections
      .map((collection) => app.vault.getFolderByPath(sceneSnapshotFolder(collection.name, scene.id)))
      .find((folder): folder is TFolder => folder !== null);
    if (!found) continue;
    await ensureFolder(app, parentFolderOf(target));
    await app.fileManager.renameFile(found, target);
  }
}

/** Moves a scene's snapshot folder to the trash once nothing is left in it. */
export async function trashEmptySnapshotFolder(app: App, folderPath: string): Promise<void> {
  const folder = app.vault.getFolderByPath(folderPath);
  if (folder && folder.children.length === 0) await trashVaultItem(app, folder);
}

/** The snapshot files of every scene of a collection. */
export function collectionSnapshotFiles(app: App, collectionId: string): string[] {
  const scenes = app.vault.getFolderByPath(collectionSnapshotsFolder(collectionId))?.children ?? [];
  return scenes
    .filter((child): child is TFolder => child instanceof TFolder)
    .flatMap((scene) => app.vault.getFolderByPath(scene.path)?.children ?? [])
    .filter((child) => child instanceof TFile && isSnapshotJsonPath(child.path))
    .map((file) => file.path);
}

/** The snapshot files of every scene in the vault. */
export function allSnapshotFiles(app: App): string[] {
  return app.vault.getFiles().map((file) => file.path).filter(isSnapshotJsonPath);
}

/** Runs `rewrite` over the snapshots of every scene of a collection (`SceneSnapshotService.rewriteFiles`). */
export function rewriteCollectionSnapshots(app: App, collectionId: string, rewrite: (content: string) => string | null): Promise<boolean> {
  return new SceneSnapshotService(app).rewriteFiles(collectionSnapshotFiles(app, collectionId), rewrite);
}
