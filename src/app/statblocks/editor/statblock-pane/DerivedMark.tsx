import React from 'react';
import { LabelTooltip } from '../../../packages/components/primitives/tooltip';
import { isExpressionError, nameOf, type LabelResolver } from '../../expressions/errors';
import { formulaText } from '../../expressions/formulaText';
import { parsePatternCached } from '../../expressions/patternParse';
import type { PatternNode } from '../../expressions/patternTypes';

function nodesInWords(nodes: readonly PatternNode[], labelOf: LabelResolver | undefined): string {
  return nodes.map((node) => {
    switch (node.kind) {
      case 'text': return node.text;
      case 'refs': return node.refs.map((ref) => nameOf(ref, labelOf)).join(', ');
      case 'formula': return formulaText(node.formula, labelOf);
      case 'optional': return nodesInWords(node.nodes, labelOf);
    }
  }).join('').trim();
}

/** A pattern as a reader says it: fields by their labels, formulas written out ("floor((Dex - 10) / 2)"). */
export function patternInWords(pattern: string, labelOf: LabelResolver | undefined): string | null {
  const ast = parsePatternCached(pattern);
  if (isExpressionError(ast)) return null;
  return nodesInWords(ast.nodes, labelOf) || null;
}

/**
 * The small ƒ after a value the template works out while its own field is
 * empty (§7.2); the tooltip says how. Typing a value of its own replaces it.
 */
export function DerivedMark({ words }: { words: string }): React.JSX.Element {
  return (
    <LabelTooltip label={`Worked out from ${words}`} multiline>
      <span className="atlas-sb-pane-derived" role="img" tabIndex={0}>ƒ</span>
    </LabelTooltip>
  );
}
