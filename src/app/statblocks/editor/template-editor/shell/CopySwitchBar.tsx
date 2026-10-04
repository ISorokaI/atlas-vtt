import React, { useState } from 'react';
import { noteName } from '../../../../utils/pathUtils';
import { copySwitchQuestion, type CopySwitch } from '../copySwitch';
import { EditorBar } from '../EditorBar';

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
