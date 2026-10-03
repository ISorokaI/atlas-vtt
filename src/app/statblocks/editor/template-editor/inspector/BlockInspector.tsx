import React, { useId } from 'react';
import { blockSpec } from '../../../model/blockCatalogue';
import { findBlock } from '../../../model/treeQueries';
import { blockName } from '../blockNames';
import { useTemplateEditor } from '../editorContext';
import { blockGlyph } from '../editorGlyphs';
import { readOnlyMessage } from '../sessionEdit';
import { AdvancedGroup } from './AdvancedGroup';
import { ContentGroup } from './ContentGroup';
import { FormatGroup } from './FormatGroup';
import type { GroupProps } from './groupProps';
import { LookGroup } from './LookGroup';
import { WhenEmptyGroup } from './WhenEmptyGroup';

/**
 * The inspector for one block (§7.4): its glyph and name, then Content, Look,
 * When empty, Format and Advanced, each only where the block has something
 * to set. A built-in shows every control, disabled, so nothing moves when its
 * copy appears.
 */
export function BlockInspector({ id, headerEnd }: { id: string; headerEnd?: React.ReactNode }): React.JSX.Element | null {
  const { session, snapshot } = useTemplateEditor();
  const titleId = useId();
  const { template } = snapshot;
  const found = findBlock(template.layout.blocks, id);
  if (!found) return null;
  const { block } = found;
  const parent = found.parentId === null ? null : findBlock(template.layout.blocks, found.parentId)?.block ?? null;
  const props: GroupProps = { block, template, session, readOnly: snapshot.readOnly, parent };
  const Glyph = blockGlyph(block.type);
  const name = blockName(block, template.fields);
  const type = blockSpec(block.type).label;
  const locked = readOnlyMessage(snapshot);
  return (
    <div className="atlas-te-insp__content" role="group" aria-labelledby={titleId}>
      <div className="atlas-te-insp__header">
        <Glyph className="atlas-te-insp__glyph" aria-hidden="true" />
        <span id={titleId} className="atlas-te-insp__name">{name}</span>
        {name !== type && <span className="atlas-te-insp__type">{type}</span>}
        {headerEnd}
      </div>
      {locked && <p className="atlas-te-insp__locked">{locked}</p>}
      <ContentGroup {...props} />
      <LookGroup {...props} />
      <WhenEmptyGroup {...props} />
      <FormatGroup {...props} />
      <AdvancedGroup {...props} />
    </div>
  );
}
