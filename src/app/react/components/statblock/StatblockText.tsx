import React, { useEffect, useRef } from 'react';
import { Component, MarkdownRenderer, type App } from 'obsidian';
import { diceLinkProps, linkDiceIn, splitDiceSegments } from '../../../services/statblockDiceLinks';
import { decodeStatblockLinks } from '../../../services/statblockLinks';
import { runInBackground } from '../../../utils/backgroundTask';

interface MarkdownTextProps {
  /** Raw text, which may contain markdown and wiki links */
  text: string;
  app?: App | undefined;
  sourcePath?: string | undefined;
  /** Render markdown; when false the text is shown as-is */
  markdown?: boolean | undefined;
  className?: string | undefined;
}

/** Text with dice notation rendered as clickable spans. */
function DiceText({ text }: { text: string }): React.JSX.Element {
  return (
    <>
      {splitDiceSegments(text).map((segment, index) =>
        segment.dice ? (
          <span key={index} {...diceLinkProps(segment.text)}>
            {segment.text}
          </span>
        ) : (
          <React.Fragment key={index}>{segment.text}</React.Fragment>
        ),
      )}
    </>
  );
}

/**
 * Statblock text. Markdown is delegated to Obsidian so wiki links, formatting
 * and embeds behave exactly as they do elsewhere in the vault.
 */
export function StatblockMarkdown({
  text,
  app,
  sourcePath = '',
  markdown = true,
  className,
}: MarkdownTextProps): React.JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !markdown || !app) return;

    el.replaceChildren();
    const component = new Component();
    runInBackground(MarkdownRenderer.render(app, decodeStatblockLinks(text), el, sourcePath, component), 'Rendering statblock markdown');

    // Obsidian wraps single-line markdown in a <p>; unwrap so it stays inline.
    const paragraphs = el.querySelectorAll('p');
    if (paragraphs.length === 1) {
      paragraphs[0]!.replaceWith(...Array.from(paragraphs[0]!.childNodes));
    }

    // Safe to rewrite: this subtree is Obsidian's markdown output, which this
    // effect rebuilds from scratch on every run. React never owns these nodes.
    linkDiceIn(el);

    // Rendered outside a note, Obsidian does not follow its links. A new tab keeps the map open.
    const openLink = (event: MouseEvent): void => {
      const link = (event.target as HTMLElement | null)?.closest?.('a.internal-link');
      const target = link?.getAttribute('data-href') ?? link?.getAttribute('href');
      if (!target) return;
      event.preventDefault();
      runInBackground(app.workspace.openLinkText(target, sourcePath, true), `Opening ${target}`, 'Could not open the linked note');
    };
    el.addEventListener('click', openLink);

    return () => {
      el.removeEventListener('click', openLink);
      component.unload();
      el.replaceChildren();
    };
  }, [text, app, sourcePath, markdown]);

  if (!markdown || !app) {
    return (
      <span className={className}>
        <DiceText text={text} />
      </span>
    );
  }

  return <span ref={ref} className={className} />;
}

export default StatblockMarkdown;
