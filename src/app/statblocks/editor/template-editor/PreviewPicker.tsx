import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { STANDING_LIST, handledByAnotherControl } from '../../../keyboard/tooltipEscape';
import { Button } from '../../../packages/components/primitives/button';
import { useKeepInView } from '../../../packages/components/primitives/useKeepInView';
import { cn } from '../../../../utils/cn';
import { noteName } from '../../../utils/pathUtils';

const SAMPLES = 'Sample values';
/** The list shows this many statblocks; typing finds the others. */
const SHOWN = 50;

export interface PreviewPickerProps {
  /** The statblocks that use the template. */
  notes: readonly string[];
  /** The one shown, or null for sample values. */
  value: string | null;
  onChange: (path: string | null) => void;
}


/**
 * "Preview with ▾" above the canvas (§7.4): sample values, or a statblock
 * that uses the template, found by typing. Where none uses it, only sample
 * values are offered.
 */
export function PreviewPicker({ notes, value, onChange }: PreviewPickerProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const keepInView = useKeepInView(popoverRef, open, 'bottom');
  const choices = useMemo((): Array<string | null> => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const found = notes.filter((path) => words.every((word) => noteName(path).toLowerCase().includes(word)));
    return [...(words.length ? [] : [null]), ...found.slice(0, SHOWN)];
  }, [notes, query]);

  useEffect(() => setActive(0), [query, open]);
  // Opened on purpose: the search takes focus, or the one choice where there is nothing to search.
  useEffect(() => {
    if (open) popoverRef.current?.querySelector<HTMLElement>('input, [role="option"]')?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const doc = rootRef.current?.doc;
    const onPointerDown = (event: PointerEvent): void => {
      if (rootRef.current && !event.composedPath().includes(rootRef.current)) setOpen(false);
    };
    doc?.addEventListener('pointerdown', onPointerDown, true);
    return () => doc?.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

  const close = (): void => {
    setOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  };
  const choose = (path: string | null): void => {
    onChange(path);
    close();
  };
  const onKeyDown = (event: React.KeyboardEvent): void => {
    const count = choices.length;
    if (event.key === 'ArrowDown' && count) setActive((index) => (index + 1) % count);
    else if (event.key === 'ArrowUp' && count) setActive((index) => (index - 1 + count) % count);
    else if (event.key === 'Enter' && count) choose(choices[Math.min(active, count - 1)] ?? null);
    else if (event.key === 'Escape' && !handledByAnotherControl(event.nativeEvent)) close();
    else return;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div ref={rootRef} className="atlas-te-preview-picker">
      <span className="atlas-te-preview-picker__label">Preview with</span>
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="sm"
        className="atlas-te-preview-picker__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
      >
        {value ? noteName(value) : SAMPLES}
        <ChevronDown aria-hidden="true" />
      </Button>
      {open && (
        <div
          ref={popoverRef}
          className={cn('atlas-te-preview-picker__popover', keepInView.capped && 'atlas-keep-in-view--capped')}
          style={keepInView.style}
          role="dialog"
          aria-label="Preview with"
          onKeyDown={onKeyDown}
        >
          {notes.length > 0 && (
            <input
              type="text"
              className="atlas-te-insert__search"
              placeholder="Find a statblock"
              aria-label="Find a statblock"
              aria-controls={listId}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          )}
          <div id={listId} role="listbox" aria-label="Preview with" className="atlas-te-preview-picker__list" {...STANDING_LIST}>
            {choices.map((path, index) => (
              <div
                key={path ?? SAMPLES}
                role="option"
                tabIndex={notes.length > 0 ? -1 : 0}
                aria-selected={path === value}
                data-highlighted={index === Math.min(active, choices.length - 1) ? '' : undefined}
                className="atlas-ctx-item"
                onPointerMove={() => setActive(index)}
                onClick={() => choose(path)}
              >
                {path ? noteName(path) : SAMPLES}
              </div>
            ))}
            {choices.length === 0 && <div className="atlas-te-insert__empty">No statblock matches</div>}
          </div>
        </div>
      )}
    </div>
  );
}
