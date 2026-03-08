import {
  collectFKFieldNames,
  getAttrName as getAttributeName,
  resolveTypeName,
} from '../extractors';
import { type Relationship, type RelationType } from '../types';
import { type DataModel, isDataModel } from '@zenstackhq/language/ast';

const MERMAID_CONNECTORS: Record<RelationType, string> = {
  'Many\u2192Many': '}o--o{',
  'Many\u2192One': '}o--||',
  'Many\u2192One?': '}o--o|',
  'One\u2192Many': '||--o{',
  'One\u2192One': '||--||',
  'One\u2192One?': '|o--o|',
};

type FullErdProps = {
  models: DataModel[];
  relations: Relationship[];
};

/**
 * Builds a complete Mermaid erDiagram string with entity bodies and relationship connectors.
 */
export function buildFullErDiagram(props: FullErdProps): string {
  const { models, relations } = props;
  const lines: string[] = ['erDiagram'];

  for (const model of [...models].sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const fkNames = collectFKFieldNames(model.fields);
    const scalarFields = model.fields.filter(
      (f) => !(f.type.reference?.ref && isDataModel(f.type.reference.ref)),
    );

    lines.push(`    ${model.name} {`);
    for (const field of scalarFields) {
      const typeName = resolveTypeName(field.type);
      const hasId = field.attributes.some((a) => getAttributeName(a) === '@id');
      const hasUnique = field.attributes.some(
        (a) => getAttributeName(a) === '@unique',
      );
      let annotation = '';
      if (hasId) {
        annotation = ' PK';
      } else if (hasUnique) {
        annotation = ' UK';
      } else if (fkNames.has(field.name)) {
        annotation = ' FK';
      }

      lines.push(`        ${typeName} ${field.name}${annotation}`);
    }

    lines.push('    }');
  }

  const seen = new Set<string>();
  for (const rel of relations) {
    const key = relationDedupKey(rel);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    lines.push(relationToMermaid(rel));
  }

  return lines.join('\n') + '\n';
}

/**
 * Returns a dedup key for a relationship. Two relationship entries that are opposite sides
 * of the same relation share the same key, while distinct relations between the same model
 * pair (e.g. different `@relation("name")`) produce different keys.
 *
 * When no explicit `@relation("name")` is present (common in implicit M:M), the key falls
 * back to the sorted model pair alone.
 */
export function relationDedupKey(rel: Relationship): string {
  const pair = [rel.from, rel.to].sort().join('--');
  if (!rel.relationName) {
    return pair;
  }

  return `${pair}::${rel.relationName}`;
}

/**
 * Maps a Relationship to a Mermaid erDiagram connector line.
 */
export function relationToMermaid(rel: Relationship): string {
  const connector = MERMAID_CONNECTORS[rel.type];
  return `    ${rel.from} ${connector} ${rel.to} : "${rel.field}"`;
}

/**
 * Renders the Mermaid ERD source to SVG using beautiful-mermaid. Returns null if unavailable.
 */
export async function renderErdSvg(
  mermaidSource: string,
  theme?: string,
): Promise<null | string> {
  try {
    const bm = await import('beautiful-mermaid');
    const themeObject =
      theme && bm.THEMES[theme] ? bm.THEMES[theme] : undefined;
    return await bm.renderMermaid(mermaidSource, themeObject);
  } catch {
    return null;
  }
}
