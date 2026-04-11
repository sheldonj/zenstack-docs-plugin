import { type Relationship, type RelationshipsPageProps } from '../types';
import { generatedHeader } from './common';
import { relationDedupKey, relationToMermaid } from './erd';

/**
 * Renders the relationships overview page with a cross-reference table and a Mermaid ER diagram.
 */
export function renderRelationshipsPage(props: RelationshipsPageProps): string {
  return [
    ...renderHeader(props),
    ...renderCrossReferenceTable(props.relations),
    ...renderErDiagram(props.relations),
  ].join('\n');
}

/**
 * Renders all relationships as a model/field/related-model/type cross-reference table.
 */
function renderCrossReferenceTable(relations: Relationship[]): string[] {
  if (relations.length === 0) {
    return [];
  }

  const lines = [
    '## Cross-Reference',
    '',
    '| Model | Field | Related Model | Type |',
    '| --- | --- | --- | --- |',
  ];
  for (const rel of relations) {
    lines.push(
      `| [${rel.from}](./models/${rel.from}.md) | ${rel.field} | [${rel.to}](./models/${rel.to}.md) | ${rel.type} |`,
    );
  }

  lines.push('');
  return lines;
}

/**
 * Renders a Mermaid ER diagram with deduplicated relationship connectors.
 */
function renderErDiagram(
  relations: RelationshipsPageProps['relations'],
): string[] {
  const seen = new Set<string>();
  const mermaidLines: string[] = [];
  for (const rel of relations) {
    const key = relationDedupKey(rel);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    mermaidLines.push(relationToMermaid(rel));
  }

  if (mermaidLines.length === 0) {
    return [];
  }

  return [
    '## Entity Relationship Diagram',
    '',
    '```mermaid',
    'erDiagram',
    ...mermaidLines,
    '```',
    '',
  ];
}

/**
 * Renders the relationships page header with breadcrumb back to the index.
 */
function renderHeader(props: RelationshipsPageProps): string[] {
  return [
    ...generatedHeader(props.genCtx, props.includeGeneratedHeader),
    '[Index](./index.md) / Relationships',
    '',
    '# Relationships',
    '',
  ];
}
