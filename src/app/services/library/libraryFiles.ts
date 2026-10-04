import type { AssetMetadata } from '../AssetService';
import { collectionFilePath, LIBRARY_FILE, recordFilePath } from './libraryPaths';
import { libraryFactsOf, serializeCollection, serializeLibrary } from './collectionFile';
import { isPayloadUnread, serializeRecord } from './recordFile';
import { assetKey, collectionIdentity, collectionKey, LIBRARY_KEY } from './libraryState';

/** One file the library consists of, with the content the index says it holds. */
export interface DesiredFile {
  key: string;
  /** What stays the same when the file moves: the asset id, the collection's uid. */
  identity: string;
  path: string;
  content: string;
  /** See `isPayloadUnread`: such a file is not written until its payload is read. */
  payloadUnread: boolean;
}

/** Every file the library consists of: a record file per asset, `collection.json` per collection, `library.json`. */
export function desiredLibraryFiles(metadata: AssetMetadata): DesiredFile[] {
  const files: DesiredFile[] = [];
  for (const asset of Object.values(metadata.assets)) {
    const path = recordFilePath(asset);
    if (!path) continue;
    files.push({ key: assetKey(asset.id), identity: assetKey(asset.id), path, content: serializeRecord(asset), payloadUnread: isPayloadUnread(asset) });
  }
  for (const collection of Object.values(metadata.collections)) {
    files.push({
      key: collectionKey(collection.id),
      identity: collectionIdentity(collection.uid),
      path: collectionFilePath(collection.id),
      content: serializeCollection(collection),
      payloadUnread: false,
    });
  }
  files.push({ key: LIBRARY_KEY, identity: LIBRARY_KEY, path: LIBRARY_FILE, content: serializeLibrary(libraryFactsOf(metadata)), payloadUnread: false });
  return files;
}
