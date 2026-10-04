import type { Asset, AssetMetadata } from '../AssetService';
import type { FileReading, LibraryChanges, RecordReading } from './libraryReader';
import { recordFilePath } from './libraryPaths';
import { assetKey, collectionIdentity, collectionKey, duplicateKey, hashText, idOfKey, LIBRARY_KEY, type FileStamp, type LibraryState } from './libraryState';
import { copyId, placedRecord, resolveHolders } from './recordHolders';
import { collectionFolderPath } from '../assetPaths';
import { moveCollectionRecord } from '../collectionRecords';
import type { PathMove } from '../renamedPaths';

export interface LibraryMergeResult {
  changed: boolean;
  /** Record files that hold a record another file already holds (copies a sync tool made on a conflict); left alone. */
  duplicates: string[];
  /** Collections whose record changed on disk, so open maps can apply their rules. */
  changedCollections: string[];
  /** Collection folders renamed outside Atlas, recognised by the `collection.json` they carried along. */
  folderMoves: PathMove[];
}

/** A collection whose folder was copied gets an identity of its own, the same on every device that sees the copy. */
const copiedCollectionUid = (uid: string, folder: string): string => `${uid.slice(0, 36)}-${hashText(folder)}`;

const PAYLOAD_TYPES: ReadonlySet<string> = new Set(['scene', 'encounter', 'player', 'character', 'statblock']);
const MIRRORED_FIELDS: Readonly<Record<string, readonly string[]>> = {
  encounter: ['tokens', 'difficulty', 'formation'],
  player: ['tokens', 'level', 'class'],
};

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

function stamp(state: LibraryState, reading: FileReading, key: string): void {
  const entry: FileStamp = { key, hash: reading.hash, mtime: reading.mtime, size: reading.size };
  if (reading.newer) entry.readOnly = true;
  state.files[reading.path] = entry;
}

/**
 * Takes the library files that changed on disk into the index: their content
 * wins over the index, which is only this device's cache of them. A record
 * whose file is gone leaves the index once this device has written its library
 * files (`migrated`); before that, the index is the only copy of its records.
 * Updates the stamps in `state` to what was read.
 */
export function mergeLibraryChanges(
  metadata: AssetMetadata,
  state: LibraryState,
  changes: LibraryChanges,
  migrated: boolean,
  hasCollectionFile: (collectionId: string) => boolean,
): LibraryMergeResult {
  let changed = false;
  const duplicates: string[] = [];
  const changedCollections: string[] = [];
  const folderMoves: PathMove[] = [];

  for (const reading of changes.touched) {
    const previous = state.files[reading.path];
    if (previous) state.files[reading.path] = { ...previous, mtime: reading.mtime, size: reading.size };
  }

  const readingsById = new Map<string, RecordReading[]>();
  for (const reading of changes.records) {
    const list = readingsById.get(reading.record.id);
    if (list) list.push(reading);
    else readingsById.set(reading.record.id, [reading]);
  }
  const upserted = new Set<string>();
  const takeIn = (record: Asset, reading: RecordReading): void => {
    const key = assetKey(record.id);
    stamp(state, reading, key);
    delete state.derived[key];
    upserted.add(record.id);
    if (sameJson(metadata.assets[record.id], record)) return;
    metadata.assets[record.id] = record;
    changed = true;
  };
  for (const [id, readings] of readingsById) {
    const { winner, duplicates: conflictCopies, copies } = resolveHolders(readings);
    for (const reading of conflictCopies) {
      duplicates.push(reading.path);
      stamp(state, reading, duplicateKey(id));
    }
    takeIn(placedRecord(winner), winner);
    for (const reading of copies) takeIn({ ...placedRecord(reading), id: copyId(id, reading.path) }, reading);
  }

  changed = mergePayloads(metadata, state, changes) || changed;

  // After the records: moving a collection's record rewrites the paths every record holds into its folder.
  for (const reading of changes.collections) {
    const id = reading.collection.id;
    let collection = reading.collection;
    const sameUid = Object.values(metadata.collections).find((other) => other.uid === collection.uid && other.id !== id);
    // A copied folder leaves the original's collection.json where it was; a renamed one took it along.
    if (sameUid && !hasCollectionFile(sameUid.id)) {
      moveCollectionRecord(metadata, sameUid.id, id);
      folderMoves.push({ from: collectionFolderPath(sameUid.id), to: collectionFolderPath(id) });
    } else if (sameUid) {
      collection = { ...collection, uid: copiedCollectionUid(collection.uid, id) };
    }
    stamp(state, reading, collectionKey(id));
    delete state.derived[collectionIdentity(collection.uid)];
    if (!sameJson(metadata.collections[id], collection)) {
      metadata.collections[id] = collection;
      changedCollections.push(id);
      changed = true;
    }
  }

  if (changes.library) {
    stamp(state, changes.library, LIBRARY_KEY);
    delete state.derived[LIBRARY_KEY];
    changed = applyLibraryFacts(metadata, changes.library.facts) || changed;
  }

  for (const { path, stamp: entry } of changes.removed) {
    delete state.files[path];
    const id = idOfKey(entry.key, 'asset');
    const asset = id ? metadata.assets[id] : undefined;
    if (!migrated || !id || !asset || upserted.has(id) || recordFilePath(asset) !== path) continue;
    delete metadata.assets[id];
    changed = true;
  }
  return { changed: changed || folderMoves.length > 0, duplicates, changedCollections, folderMoves };
}

/** Payloads older versions wrote into the JSON of records the index knows: the file's payload wins, as records do. */
function mergePayloads(metadata: AssetMetadata, state: LibraryState, changes: LibraryChanges): boolean {
  if (changes.payloads.length === 0) return false;
  const byPath = new Map<string, Asset>();
  for (const asset of Object.values(metadata.assets)) {
    if (PAYLOAD_TYPES.has(asset.type)) byPath.set(recordFilePath(asset), asset);
  }
  let changed = false;
  for (const reading of changes.payloads) {
    const asset = byPath.get(reading.path);
    if (!asset) continue;
    stamp(state, reading, assetKey(asset.id));
    if (sameJson('data' in asset ? asset.data : undefined, reading.payload)) continue;
    const updated: Record<string, unknown> = { ...asset, data: reading.payload };
    for (const key of MIRRORED_FIELDS[asset.type] ?? []) {
      if (key in reading.payload) updated[key] = reading.payload[key];
    }
    Object.assign(asset, updated);
    changed = true;
  }
  return changed;
}

/** Library facts from `library.json`; a fact it lacks keeps the index's value, and the starter tokens stay added once added anywhere. */
function applyLibraryFacts(metadata: AssetMetadata, facts: { defaultCollectionId?: string; vaultId?: string; starterTokensAdded?: boolean }): boolean {
  let changed = false;
  if (facts.defaultCollectionId && facts.defaultCollectionId !== metadata.defaultCollectionId) {
    metadata.defaultCollectionId = facts.defaultCollectionId;
    changed = true;
  }
  if (facts.vaultId && facts.vaultId !== metadata.vaultId) {
    metadata.vaultId = facts.vaultId;
    changed = true;
  }
  if (facts.starterTokensAdded && !metadata.starterTokensAdded) {
    metadata.starterTokensAdded = true;
    changed = true;
  }
  return changed;
}
