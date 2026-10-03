import React, { useRef, useState } from 'react';
import { Button } from '../../../../packages/components/primitives/button';
import type { TemplateSource } from '../../../model/templateTypes';
import { AttributionText } from '../../gallery/AttributionPopover';
import { EditorDialog } from './EditorDialog';

export interface AttributionBlockProps {
  source: TemplateSource;
  disabled: boolean;
  onRemove: () => void;
}

/**
 * The credit a licensed template carries (§10.5), the same block the
 * gallery's cards show. Copies keep it; Remove attribution asks first.
 */
export function AttributionBlock({ source, disabled, onRemove }: AttributionBlockProps): React.JSX.Element {
  const [opener, setOpener] = useState<HTMLButtonElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = (): void => {
    setOpener(null);
    buttonRef.current?.focus();
  };
  return (
    <div className="atlas-te-credit atlas-te-span">
      <AttributionText source={source} />
      <Button ref={buttonRef} type="button" variant="ghost" size="sm" className="atlas-te-credit__remove" disabled={disabled}
        onClick={() => setOpener(buttonRef.current)}>
        Remove attribution
      </Button>
      {opener && (
        <EditorDialog
          anchor={opener}
          title="Remove attribution?"
          onClose={close}
          footer={(
            <>
              <Button type="button" variant="outline" size="sm" onClick={close}>Cancel</Button>
              <Button type="button" variant="destructive" size="sm" onClick={() => { setOpener(null); onRemove(); }}>Remove</Button>
            </>
          )}
        >
          <p className="atlas-te-dialog__text">The licence may require this credit wherever you share the template.</p>
        </EditorDialog>
      )}
    </div>
  );
}
