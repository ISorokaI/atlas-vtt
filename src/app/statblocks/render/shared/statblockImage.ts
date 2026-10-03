import type { App } from 'obsidian';

const WIKI_BRACKETS = /(^\[\[|\]\]$)/g;
const WEB_ADDRESS = /^https?:/;

/** A value with a stray `%` is not percent-encoded; it is read as written. */
function decoded(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * The address a statblock's image value can be shown from: a web address as
 * it is, a vault path or wiki link (`[[Wolf.png|alias]]`) through the vault,
 * or '' where the vault holds no such file. Without an app the value is
 * returned as written.
 */
export function statblockImageSrc(app: App | undefined, raw: string, sourcePath: string | undefined): string {
  if (!raw) return '';
  const src = decoded(raw).replace(WIKI_BRACKETS, '').split('|')[0] ?? '';
  if (WEB_ADDRESS.test(src) || !app) return src;
  const file = app.metadataCache.getFirstLinkpathDest(src, sourcePath ?? '');
  return file ? app.vault.getResourcePath(file) : '';
}
