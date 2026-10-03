import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence } from 'framer-motion';
import type { CollectionChoice } from '../collectionContext';
import { NewStatblockPopover } from './NewStatblockPopover';
import { FloatingRoleMenu } from './RoleMenu';
import { needsRoleMenu, type RoleChoice } from './roleChoices';

/** What the user chose: the role, its collection, and the name the statblock gets. */
export interface CreationChoice {
  roleId: string;
  collectionId: string;
  name: string;
}

export interface CreationPromptOptions {
  doc: Document;
  /** Where the menu hangs from and the popover grows out of, in the window's coordinates. */
  at: { x: number; y: number };
  collections: readonly CollectionChoice[];
  collectionId: string;
  offersCollection: boolean;
  choicesOf: (collectionId: string) => readonly RoleChoice[];
}

interface CreationPromptProps extends CreationPromptOptions {
  /** Called once: with the choice, or null when the user backed out. */
  onDone: (choice: CreationChoice | null) => void;
  /** Everything has left the screen: the host may go. */
  onGone: () => void;
}

type Step =
  | { kind: 'role' }
  | { kind: 'name'; roleId: string; collectionId: string }
  | { kind: 'done' };

/** Skips the role menu where there is one role and no collection to choose (§7.3). */
function firstStep({ choicesOf, collectionId, offersCollection }: CreationPromptOptions): Step {
  const choices = choicesOf(collectionId);
  const [only] = choices;
  return needsRoleMenu(choices, offersCollection) || !only ? { kind: 'role' } : { kind: 'name', roleId: only.roleId, collectionId };
}

/** The role menu, then the name popover, for a statblock made without a token. */
export function CreationPrompt(props: CreationPromptProps): React.JSX.Element {
  const { doc, at, choicesOf, onDone, onGone } = props;
  const [step, setStep] = useState<Step>(() => firstStep(props));
  // Radix reports a chosen role as the menu closing too: the step is read here before React has re-rendered.
  const current = useRef(step);
  const shownPopover = useRef(step.kind === 'name');
  const move = (next: Step): void => {
    current.current = next;
    setStep(next);
  };
  const finish = (choice: CreationChoice | null): void => {
    if (current.current.kind === 'done') return;
    move({ kind: 'done' });
    onDone(choice);
  };

  // Without the popover there is no exit to wait for.
  useEffect(() => {
    if (step.kind === 'done' && !shownPopover.current) onGone();
  }, [step.kind, onGone]);

  const role = step.kind === 'name' ? choicesOf(step.collectionId).find((choice) => choice.roleId === step.roleId) : undefined;
  return (
    <>
      {step.kind === 'role' && (
        <FloatingRoleMenu
          doc={doc}
          at={at}
          collections={props.collections}
          collectionId={props.collectionId}
          offersCollection={props.offersCollection}
          choicesOf={choicesOf}
          onChoose={(roleId, collectionId) => {
            shownPopover.current = true;
            move({ kind: 'name', roleId, collectionId });
          }}
          onDismiss={() => { if (current.current.kind === 'role') finish(null); }}
        />
      )}
      <AnimatePresence onExitComplete={onGone}>
        {step.kind === 'name' && (
          <div key="name" className="atlas-sb-create-spot" style={{ left: at.x, top: at.y }}>
            <NewStatblockPopover
              roleName={role?.name ?? ''}
              onCreate={(name) => finish({ roleId: step.roleId, collectionId: step.collectionId, name })}
              onCancel={() => finish(null)}
            />
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Shows the prompt in `doc` (the window the command was given in) and resolves
 * with the choice, or null. Focus goes back where it was when the user backs out.
 */
export function promptStatblockCreation(options: CreationPromptOptions): Promise<CreationChoice | null> {
  const { doc } = options;
  const previous = doc.activeElement;
  const container = doc.body.createDiv({ cls: ['atlas-vtt-plugin', 'atlas-sb-create-host'] });
  const root = createRoot(container);
  return new Promise((resolve) => {
    const onDone = (choice: CreationChoice | null): void => {
      if (!choice && previous?.instanceOf(HTMLElement) && previous.isConnected) previous.focus({ preventScroll: true });
      resolve(choice);
    };
    let gone = false;
    const onGone = (): void => {
      if (gone) return;
      gone = true;
      // Never inside React's own commit.
      queueMicrotask(() => {
        root.unmount();
        container.remove();
      });
    };
    root.render(<CreationPrompt {...options} onDone={onDone} onGone={onGone} />);
  });
}
