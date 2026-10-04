/**
 * Fantasy Statblocks hands out bestiary values with their links encoded:
 * `<STATBLOCK-WIKI-LINK>path|alias<STATBLOCK-WIKI-LINK>` for `[[path|alias]]` and
 * `<STATBLOCK-MARKDOWN-LINK>path|alias<STATBLOCK-MARKDOWN-LINK>` for `[alias](path)`.
 * Markdown reads the markers as HTML and drops them, which left `path|alias` as text.
 */
const ENCODED_WIKI_LINK = /<STATBLOCK-WIKI-LINK>([\s\S]+?)<STATBLOCK-WIKI-LINK>/g;
const ENCODED_MARKDOWN_LINK = /<STATBLOCK-MARKDOWN-LINK>([\s\S]+?)(?:\|([\s\S]+?))?<STATBLOCK-MARKDOWN-LINK>/g;

/** The links of a bestiary value as the note wrote them, as Fantasy Statblocks' own `stringifyLinks` does. */
export function decodeStatblockLinks(text: string): string {
  return text
    .replace(ENCODED_WIKI_LINK, (_match, link: string) => `[[${link}]]`)
    // Angle brackets keep a path with spaces one link destination.
    .replace(ENCODED_MARKDOWN_LINK, (_match, path: string, alias: string | undefined) => `[${alias ?? ''}](<${path}>)`);
}
