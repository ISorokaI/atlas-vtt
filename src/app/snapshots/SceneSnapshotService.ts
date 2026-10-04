import { TFile, type App } from 'obsidian';
import { ensureFolder } from '../plugin/vaultFolders';
import { isPersistedMapEnvelope, type PersistedMapEnvelope } from '../services/MapPersistence';
import { trashVaultItem } from '../utils/trashVaultItem';
import { createSnapshot, isSceneSnapshot, restoreSnapshot, type SceneSnapshot } from './sceneSnapshotFormat';
import { parentFolderOf, snapshotFilePath, snapshotThumbnailPath } from './snapshotPaths';
import { trashEmptySnapshotFolder } from './sceneSnapshotFolders';

export interface SceneSnapshotEntry {
  snapshot: SceneSnapshot;
  /** Vault path of the snapshot file. */
  path: string;
  /** Vault path of its thumbnail, when it has one. */
  thumbnailPath: string | null;
}

const DEFAULT_NAME = 'Snapshot';

/** The first free default name: "Snapshot 3" when "Snapshot 1" and "Snapshot 2" exist. */
export function nextSnapshotName(existingNames: readonly string[]): string {
  const taken = new Set(existingNames);
  let n = existingNames.length + 1;
  while (taken.has(`${DEFAULT_NAME} ${n}`)) n++;
  return `${DEFAULT_NAME} ${n}`;
}

function parseJson(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Reads and writes the snapshots of a scene: one JSON file per snapshot plus
 * a JPEG thumbnail, in the scene's snapshot folder (`sceneSnapshotFolder`).
 * They are ordinary vault files, so sync tools carry them. Works on files
 * only; the open map view flushes and reloads around it.
 */
export class SceneSnapshotService {
  constructor(private readonly app: App) {}

  /** The snapshots in `folder`, newest first. Files that cannot be read are skipped. */
  async list(folder: string): Promise<SceneSnapshotEntry[]> {
    const children = this.app.vault.getFolderByPath(folder)?.children ?? [];
    const paths = new Set(children.map((child) => child.path));
    const entries: SceneSnapshotEntry[] = [];
    for (const child of children) {
      if (!(child instanceof TFile) || child.extension !== 'json') continue;
      const snapshot = await this.read(child);
      if (!snapshot) continue;
      const thumbnailPath = snapshotThumbnailPath(folder, snapshot.id);
      entries.push({ snapshot, path: child.path, thumbnailPath: paths.has(thumbnailPath) ? thumbnailPath : null });
    }
    return entries.sort((a, b) => b.snapshot.createdAt - a.snapshot.createdAt);
  }

  /** An image URL for the entry's thumbnail that changes whenever the snapshot is overwritten. */
  thumbnailUrl(entry: SceneSnapshotEntry): string | null {
    const file = entry.thumbnailPath ? this.app.vault.getFileByPath(entry.thumbnailPath) : null;
    if (!file) return null;
    const url = this.app.vault.getResourcePath(file);
    const version = entry.snapshot.updatedAt ?? entry.snapshot.createdAt;
    return `${url}${url.includes('?') ? '&' : '?'}v=${version}`;
  }

  /** Saves what the map file holds now as a new snapshot in `folder`. Flush pending map saves first. */
  async create(folder: string, mapFile: TFile, name: string, thumbnail: ArrayBuffer | null): Promise<SceneSnapshot> {
    const envelope = await this.readMap(mapFile);
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const snapshot = createSnapshot(envelope, id, name, Date.now());
    await ensureFolder(this.app, folder);
    await this.app.vault.create(snapshotFilePath(folder, id), JSON.stringify(snapshot));
    if (thumbnail) await this.writeThumbnail(snapshotThumbnailPath(folder, id), thumbnail);
    return snapshot;
  }

  /**
   * Replaces the snapshot's state and thumbnail with what the map file holds
   * now. It keeps its id, name and creation time. Flush pending map saves first.
   */
  async overwrite(entry: SceneSnapshotEntry, mapFile: TFile, thumbnail: ArrayBuffer | null): Promise<SceneSnapshot> {
    const { id, name, createdAt } = entry.snapshot;
    const snapshot: SceneSnapshot = { ...createSnapshot(await this.readMap(mapFile), id, name, createdAt), updatedAt: Date.now() };
    await this.writeJson(entry.path, () => JSON.stringify(snapshot));
    if (thumbnail) await this.writeThumbnail(snapshotThumbnailPath(parentFolderOf(entry.path), id), thumbnail);
    return snapshot;
  }

  async rename(entry: SceneSnapshotEntry, name: string): Promise<void> {
    await this.writeJson(entry.path, (data) => {
      const snapshot = parseJson(data);
      return isSceneSnapshot(snapshot) ? JSON.stringify({ ...snapshot, name }) : data;
    });
  }

  /** Moves the snapshot and its thumbnail to the trash, and the scene's folder too once it is empty. */
  async delete(entry: SceneSnapshotEntry): Promise<void> {
    for (const path of [entry.path, entry.thumbnailPath]) {
      const file = path ? this.app.vault.getFileByPath(path) : null;
      if (file) await trashVaultItem(this.app, file);
    }
    await trashEmptySnapshotFolder(this.app, parentFolderOf(entry.path));
  }

  /** Writes the snapshot's state into the map file. The open view must reload the map afterwards. */
  async restoreInto(mapFile: TFile, snapshot: SceneSnapshot): Promise<void> {
    await this.app.vault.process(mapFile, (data) => {
      const parsed = parseJson(data);
      const current: PersistedMapEnvelope = isPersistedMapEnvelope(parsed) ? parsed : {};
      return JSON.stringify(restoreSnapshot(current, snapshot, mapFile.path));
    });
  }

  /**
   * Runs `rewrite` over each snapshot file in `paths` and saves the files it
   * returns new content for. A file that fails is reported and skipped.
   * Returns whether any file changed.
   */
  async rewriteFiles(paths: Iterable<string>, rewrite: (content: string) => string | null): Promise<boolean> {
    let changed = false;
    for (const path of paths) {
      const file = this.app.vault.getFileByPath(path);
      if (!file) continue;
      try {
        if (rewrite(await this.app.vault.read(file)) === null) continue;
        await this.app.vault.process(file, (latest) => rewrite(latest) ?? latest);
        changed = true;
      } catch (error) {
        console.error(`[Atlas] Could not update the snapshot ${path}:`, error);
      }
    }
    return changed;
  }

  private async writeJson(path: string, change: (data: string) => string): Promise<void> {
    const file = this.app.vault.getFileByPath(path);
    if (!file) throw new Error(`Snapshot file not found: ${path}`);
    await this.app.vault.process(file, change);
  }

  private async writeThumbnail(path: string, data: ArrayBuffer): Promise<void> {
    const existing = this.app.vault.getFileByPath(path);
    if (existing) await this.app.vault.modifyBinary(existing, data);
    else await this.app.vault.createBinary(path, data);
  }

  private async readMap(mapFile: TFile): Promise<PersistedMapEnvelope> {
    const envelope = parseJson(await this.app.vault.read(mapFile));
    if (!isPersistedMapEnvelope(envelope) || !envelope.state) {
      throw new Error(`Map file cannot be read: ${mapFile.path}`);
    }
    return envelope;
  }

  private async read(file: TFile): Promise<SceneSnapshot | null> {
    const parsed = parseJson(await this.app.vault.read(file));
    return isSceneSnapshot(parsed) ? parsed : null;
  }
}
