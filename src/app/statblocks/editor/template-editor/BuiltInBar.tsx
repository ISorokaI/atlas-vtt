import React, { useState } from 'react';
import { copySwitchQuestion, type CopySwitch } from './copySwitch';
import { EditorBar } from './EditorBar';

function noteName(path: string): string {
  return (path.split('/').pop() ?? path).replace(/\.md$/i, '');
}

export interface BuiltInBarProps {
  /** Why the template takes no edits. */
  reason: 'built-in' | 'newer';
  /** Makes an editable copy and opens it here; unset while a copy is being made. */
  onCopy?: (() => void) | undefined;
}

/**
 * Above a template the editor does not change (§7.4): a built-in, with Make a
 * copy, or a template of a newer Atlas. The canvas and inspector stay as they
 * are, so nothing moves when the copy appears.
 */
export function BuiltInBar({ reason, onCopy }: BuiltInBarProps): React.JSX.Element {
  if (reason === 'newer') return <EditorBar text="Made with a newer Atlas. Update Atlas to edit this template." />;
  return (
    <EditorBar
      text="Built-in template. Make a copy to change it."
      actions={[{ label: 'Make a copy', primary: true, disabled: !onCopy, onClick: () => onCopy?.() }]}
    />
  );
}

export interface CopySwitchBarProps {
  question: CopySwitch;
  onSwitch: () => Promise<void>;
  onKeep: () => void;
}

/**
 * After the copy, the one question (§7.4): "Use the copy for the 12
 * statblocks and the role Monster of Marsh campaign?" The statblocks it would
 * switch are listed first; Switch changes them in one batch.
 */
export function CopySwitchBar({ question, onSwitch, onKeep }: CopySwitchBarProps): React.JSX.Element | null {
  const [listed, setListed] = useState(false);
  const [busy, setBusy] = useState(false);
  const text = copySwitchQuestion(question);
  if (!text) return null;
  const switchNow = (): void => {
    setBusy(true);
    void onSwitch().finally(() => setBusy(false));
  };
  const actions = [
    ...(question.notes.length > 0 ? [{ label: listed ? 'Hide statblocks' : 'Show statblocks', onClick: () => setListed((was) => !was) }] : []),
    { label: 'Keep', disabled: busy, onClick: onKeep },
    { label: busy ? 'Switching…' : 'Switch', primary: true, disabled: busy, onClick: switchNow },
  ];
  return (
    <EditorBar text={text} actions={actions}>
      {listed && (
        <ul className="atlas-te-bar__list" aria-label="Statblocks that would switch">
          {question.notes.map((path) => <li key={path}>{noteName(path)}</li>)}
        </ul>
      )}
    </EditorBar>
  );
}
