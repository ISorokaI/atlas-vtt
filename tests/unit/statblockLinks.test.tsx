import React from 'react';
import { act, render } from '@testing-library/react';
import { MarkdownRenderer, type App } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import { plainText } from '../../src/app/creatures/creatureValues';
import { StatblockMarkdown } from '../../src/app/react/components/statblock/StatblockText';
import { decodeStatblockLinks } from '../../src/app/services/statblockLinks';

const WIKI = '<STATBLOCK-WIKI-LINK>Senses/Scent|scent<STATBLOCK-WIKI-LINK>';
const MARKDOWN = '<STATBLOCK-MARKDOWN-LINK>rules/my skills.md#Perception|Perception<STATBLOCK-MARKDOWN-LINK>';

describe('links of bestiary values', () => {
  it('reads as the note wrote them', () => {
    expect(decodeStatblockLinks(`${WIKI} 30 feet, ${MARKDOWN} +7`))
      .toBe('[[Senses/Scent|scent]] 30 feet, [Perception](<rules/my skills.md#Perception>) +7');
    expect(decodeStatblockLinks('<STATBLOCK-MARKDOWN-LINK>rules/a.md<STATBLOCK-MARKDOWN-LINK>')).toBe('[](<rules/a.md>)');
  });

  it('read as the words they show', () => {
    expect(plainText(`${WIKI}, ${MARKDOWN}`)).toBe('scent, Perception');
    expect(plainText('<STATBLOCK-MARKDOWN-LINK>rules/Grappled.md<STATBLOCK-MARKDOWN-LINK>')).toBe('Grappled');
  });

  it('render as links, and a click opens the note in a new tab', async () => {
    const openLinkText = vi.fn(() => Promise.resolve());
    const app = { workspace: { openLinkText } } as unknown as App;
    const rendered = vi.spyOn(MarkdownRenderer, 'render').mockImplementation((_app, markdown, el) => {
      const link = el.ownerDocument.createElement('a');
      link.className = 'internal-link';
      link.setAttribute('data-href', 'rules/my skills.md#Perception');
      link.textContent = markdown;
      el.appendChild(link);
      return Promise.resolve();
    });
    const { container } = render(<StatblockMarkdown text={MARKDOWN} app={app} sourcePath="Bestiary/Goblin.md" />);
    expect(rendered.mock.calls[0]![1]).toBe('[Perception](<rules/my skills.md#Perception>)');

    act(() => container.querySelector('a')!.click());
    expect(openLinkText).toHaveBeenCalledWith('rules/my skills.md#Perception', 'Bestiary/Goblin.md', true);
    rendered.mockRestore();
  });
});
