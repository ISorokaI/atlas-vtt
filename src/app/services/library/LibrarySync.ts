import type { App } from 'obsidian';
import { collectionFilePath } from './libraryPaths';
import type { AssetMetadata } from '../AssetService';
import { desiredLibraryFiles } from './libraryFiles';
import { readLibraryChanges } from './libraryReader';
import { mergeLibraryChanges, type LibraryMergeResult } from './mergeLibraryChanges';
import { LibraryWriter } from './libraryWriter';
import { LIBRARY_FILE_FORMAT } from './collectionFile';
import { RECORD_FORMAT } from './recordFile';
import { assetKey, emptyLibraryState, hashText, idOfKey, type LibraryState } from './libraryState';
import { isRecoveredId } from '../vault-sync/recoveredIds';

/** Local-storage key recording that this device keeps its library in vault files. Per device on purpose: every device migrates its own index. */
const MIGRATED_KEY = 'atlas-vtt:library-files';


/**
 * Keeps the library's vault files and the index, this device's cache of them,
 * in step: reads the files that changed, writes the records that changed, and
 * keeps the device-local bookkeeping (stamps of known files, derived records).
 */
export class LibrarySync {
  private state: LibraryState = emptyLibraryState();
  private readonly writer: LibraryWriter;
  /** Whether the files have been read once; until then nothing is written, so no file is written from an index older than the vault. */
  private filesRead = false;
  private filesWritten = false;

  constructor(private readonly app: App) {
    this.writer = new LibraryWriter(app, () => this.state);
  }

  /** The bookkeeping stored with the index, which keeps the two consistent wherever the index comes from. */
  get bookkeeping(): LibraryState {
    return this.state;
  }

  /** Takes the bookkeeping stored with a loaded index. */
  restore(state: LibraryState): void {
    this.state = state;
  }

  /** Whether this device has written its library to vault files. */
  get migrated(): boolean {
    return this.app.loadLocalStorage(MIGRATED_KEY) === true;
  }

  /** Whether the files were read but not yet written this session: the first write brings them in line with the index (on the first start, it migrates). */
  get awaitsFirstWrite(): boolean {
    return this.filesRead && !this.filesWritten;
  }

  /** Reads the library files that changed and takes them into `metadata`. */
  async read(metadata: AssetMetadata): Promise<LibraryMergeResult> {
    const changes = await readLibraryChanges(this.app, this.state, RECORD_FORMAT, LIBRARY_FILE_FORMAT);
    const hasCollectionFile = (id: string): boolean => this.app.vault.getFileByPath(collectionFilePath(id)) !== null;
    const result = mergeLibraryChanges(metadata, this.state, changes, this.migrated, hasCollectionFile);
    this.filesRead = true;
    if (result.duplicates.length > 0) {
      console.warn('[Atlas library] These files hold a record another file already holds (copies a sync tool made on a conflict) and were left alone:', result.duplicates);
    }
    return result;
  }

  /** The identity and key of every library entity, to tell afterwards what an automatic step created. */
  entityIdentities(metadata: AssetMetadata): Set<string> {
    return new Set(desiredLibraryFiles(metadata).flatMap((file) => [file.identity, file.key]));
  }

  /**
   * After a step Atlas took by itself (loading, a vault check): records it
   * created without a file, and records that were derived before, stay derived
   * with their new content; they are written once the user changes them.
   */
  markDerived(metadata: AssetMetadata, before: ReadonlySet<string>): void {
    const migrated = this.migrated;
    const present = new Set<string>();
    for (const file of desiredLibraryFiles(metadata)) {
      present.add(file.identity);
      const hasFile = this.app.vault.getFileByPath(file.path) !== null;
      const assetId = idOfKey(file.key, 'asset');
      const createdNow = !before.has(file.identity) && !before.has(file.key) && !hasFile;
      const recoveredBeforeMigration = !migrated && assetId !== null && isRecoveredId(assetId) && !hasFile;
      if (this.state.derived[file.identity] !== undefined || createdNow || recoveredBeforeMigration) {
        this.state.derived[file.identity] = hashText(file.content);
      }
    }
    for (const identity of Object.keys(this.state.derived)) if (!present.has(identity)) delete this.state.derived[identity];
  }

  /** Writes what changed to the library files, once they have been read; the first full write migrates this device. */
  async persist(snapshot: AssetMetadata): Promise<void> {
    if (!this.filesRead) return;
    await this.writer.write(desiredLibraryFiles(snapshot));
    this.filesWritten = true;
    if (!this.migrated) this.app.saveLocalStorage(MIGRATED_KEY, true);
  }

  /** Whether the record of `id` has a file this device read or wrote, so its art or map missing for now does not remove it. */
  hasRecordFile(id: string, path: string): boolean {
    return this.state.files[path]?.key === assetKey(id);
  }
}
