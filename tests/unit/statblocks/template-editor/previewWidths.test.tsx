import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '../../../../src/app/packages/components/primitives/tooltip';
import { previewWidthOf } from '../../../../src/app/statblocks/editor/template-editor/PreviewWidths';
import { TemplateEditor } from '../../../../src/app/statblocks/editor/template-editor/TemplateEditor';
import {
  STATBLOCK_FEED_MAX_WIDTH, STATBLOCK_PREVIEW_MAX_WIDTH, STATBLOCK_PREVIEW_WIDE_FROM, STATBLOCK_PREVIEW_WIDE_MAX_WIDTH,
} from '../../../../src/app/statblocks/render/statblockSurfaceWidths';
import { FakeSession, sampleTemplate } from './editorKit';

afterEach(cleanup);

describe('preview widths', () => {
  it('takes the hover preview\'s width for the window, the widest feed, or the canvas\'s own', () => {
    expect(previewWidthOf('hover', STATBLOCK_PREVIEW_WIDE_FROM - 1)).toBe(STATBLOCK_PREVIEW_MAX_WIDTH);
    expect(previewWidthOf('hover', STATBLOCK_PREVIEW_WIDE_FROM)).toBe(STATBLOCK_PREVIEW_WIDE_MAX_WIDTH);
    expect(previewWidthOf('feed', 800)).toBe(STATBLOCK_FEED_MAX_WIDTH);
    expect(previewWidthOf('pane', 2000)).toBeUndefined();
  });

  it('sets the canvas to the chosen width from the header\'s chips', () => {
    const noop = vi.fn();
    render(
      <TooltipProvider>
        <TemplateEditor session={new FakeSession(sampleTemplate())} host={{ openTemplate: noop, openNote: noop, close: noop }}
          previewPath={null} onPreviewPathChange={noop} collectionId={null} onCollectionChange={noop} />
      </TooltipProvider>,
    );
    const stage = document.querySelector<HTMLElement>('.atlas-te-stage')!;
    expect(screen.getByRole('radio', { name: 'Pane' }).getAttribute('aria-checked')).toBe('true');
    expect(stage.hasAttribute('data-sized')).toBe(false);

    fireEvent.click(screen.getByRole('radio', { name: 'Feed' }));
    expect(stage.getAttribute('data-sized')).toBe('');
    expect(stage.style.getPropertyValue('--atlas-te-card-width')).toBe(`${STATBLOCK_FEED_MAX_WIDTH}px`);

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: STATBLOCK_PREVIEW_WIDE_FROM + 10 });
    fireEvent.click(screen.getByRole('radio', { name: 'Hover' }));
    expect(stage.style.getPropertyValue('--atlas-te-card-width')).toBe(`${STATBLOCK_PREVIEW_WIDE_MAX_WIDTH}px`);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: STATBLOCK_PREVIEW_WIDE_FROM - 10 });
    fireEvent(window, new Event('resize'));
    expect(stage.style.getPropertyValue('--atlas-te-card-width')).toBe(`${STATBLOCK_PREVIEW_MAX_WIDTH}px`);

    fireEvent.click(screen.getByRole('radio', { name: 'Pane' }));
    expect(stage.hasAttribute('data-sized')).toBe(false);
  });
});
