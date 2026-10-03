import React from 'react';
import type { LineBlock } from '../../model/templateTypes';
import { DisplayText } from '../values/ValueText';
import type { BlockViewProps } from './blockViewProps';

/** The muted italic line under a title: "Large plant, unaligned". */
export function LineView({ display }: BlockViewProps<LineBlock>): React.JSX.Element {
  return (
    <div className="atlas-sb-line">
      <DisplayText display={display} />
    </div>
  );
}
