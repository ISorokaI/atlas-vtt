import { isRecord } from '../assetMetadataGuards';
import { isRecordFileCandidate } from '../library/libraryPaths';
import { RECORD_KEY } from '../library/recordFile';
import { toBuffer } from './bundleContent';

const decoder = new TextDecoder();

/**
 * A record file as bundles carry and compare it: the payload alone, as versions
 * before record files wrote it. The record beside it is the vault's own (its
 * timestamps change with every edit) and travels in the manifest instead, so
 * bundles stay readable by older versions and an update never mistakes Atlas
 * rewriting a record for the user changing the file.
 */
export function payloadBytes(path: string, raw: ArrayBuffer): ArrayBuffer {
  if (!isRecordFileCandidate(path)) return raw;
  const text = decoder.decode(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return raw;
  }
  if (!isRecord(parsed) || !(RECORD_KEY in parsed)) return raw;
  const { [RECORD_KEY]: _record, ...payload } = parsed;
  return toBuffer(JSON.stringify(payload, null, 2));
}
