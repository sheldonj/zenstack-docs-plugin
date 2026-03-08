import {
  extractProcedureComments,
  formatAttrArgs as formatAttributeArgs,
  getAttrName as getAttributeName,
  resolveTypeName,
  stripCommentPrefix,
} from '../extractors';
import { type SkillPageProps } from '../types';
import {
  type DataField,
  type DataModel,
  type Enum,
  isDataModel,
  type Procedure,
  type TypeDef,
} from '@zenstackhq/language/ast';

type SkillCounts = {
  enums: number;
  models: number;
  procedures: number;
  types: number;
  views: number;
};

/**
 * Renders a `SKILL.md` file — an AI-agent-readable schema reference designed for
 * use as a skill definition in tools like Cursor, Claude Code, and skills.sh.
 *
 * The output includes a schema overview, detected conventions, access/validation constraints,
 * workflow guidance, and a full entity reference with prisma declaration blocks.
 */
export function renderSkillPage(props: SkillPageProps): string {
  const {
    enums,
    hasRelationships,
    models,
    procedures,
    title,
    typeDefs,
    views,
  } = props;
  const counts: SkillCounts = {
    enums: enums.length,
    models: models.length,
    procedures: procedures.length,
    types: typeDefs.length,
    views: views.length,
  };

  return [
    ...renderFrontmatter(title),
    ...renderOverview(title, counts, models, views),
    ...renderConventions(models, typeDefs),
    ...renderConstraints(models),
    ...renderWorkflow(procedures, hasRelationships),
    ...renderEntityReference(models, enums, typeDefs, views),
    ...renderFooter(hasRelationships),
  ].join('\n');
}

/**
 * Finds all `@computed` fields across models for the conventions section.
 */
function detectComputedFields(models: DataModel[]): string[] {
  const computed: string[] = [];
  for (const m of models) {
    for (const f of m.fields) {
      if (f.attributes.some((a) => getAttributeName(a) === '@computed')) {
        const desc = f.comments ? stripCommentPrefix(f.comments) : '';
        const descPart = desc ? ` — ${desc}` : '';
        computed.push(`- ${m.name}.${f.name}${descPart}`);
      }
    }
  }

  return computed;
}

/**
 * Extracts example foreign key field names from `@relation` attributes across models.
 */
function detectFKExamples(models: DataModel[]): string[] {
  const fks: string[] = [];
  for (const m of models) {
    for (const f of m.fields) {
      if (!(f.type.reference?.ref && isDataModel(f.type.reference.ref))) {
        continue;
      }

      if (f.type.array) {
        continue;
      }

      const relAttribute = f.attributes.find(
        (a) => getAttributeName(a) === '@relation',
      );
      if (!relAttribute) {
        continue;
      }

      const fieldsArgument = relAttribute.args.find((a) => {
        const argText = a.$cstNode?.text ?? '';
        return argText.includes('fields:') || argText.startsWith('[');
      });
      if (!fieldsArgument) {
        continue;
      }

      const text = fieldsArgument.$cstNode?.text ?? '';
      const bracketMatch = text.match(/\[([^\]]+)\]/u);
      if (!bracketMatch) {
        continue;
      }

      for (const fk of bracketMatch[1]!.split(',').map((s) => s.trim())) {
        if (fk && !fks.includes(fk)) {
          fks.push(fk);
        }
      }
    }
  }

  return fks;
}

/**
 * Analyzes `@id` + `@default` patterns across models to describe the ID generation convention.
 */
function detectIdConvention(models: DataModel[]): string {
  const defaults = new Map<string, number>();
  for (const m of models) {
    for (const f of m.fields) {
      const isId = f.attributes.some((a) => getAttributeName(a) === '@id');
      if (!isId) {
        continue;
      }

      const defaultAttribute = f.attributes.find(
        (a) => getAttributeName(a) === '@default',
      );
      const value = defaultAttribute?.args[0]?.$cstNode?.text ?? 'none';
      defaults.set(value, (defaults.get(value) ?? 0) + 1);
    }
  }

  if (defaults.size === 0) {
    return 'No consistent ID convention detected.';
  }

  const sorted = [...defaults.entries()].sort((a, b) => b[1] - a[1]);
  const [primary, count] = sorted[0]!;
  if (count === models.length) {
    return `All models use \`@default(${primary})\` for IDs.`;
  }

  const exceptions = sorted
    .slice(1)
    .map(([function_, c]) => `${c} use \`${function_}\``)
    .join(', ');
  return `Most models use \`@default(${primary})\` for IDs. Exceptions: ${exceptions}.`;
}

/**
 * Lists which type definitions are used as mixins and by which models.
 */
function detectMixins(models: DataModel[], typeDefs: TypeDef[]): string[] {
  if (typeDefs.length === 0) {
    return [];
  }

  const lines: string[] = [];
  for (const td of typeDefs) {
    const users = models.filter((m) =>
      m.mixins.some((mx) => mx.ref?.name === td.name),
    );
    if (users.length > 0) {
      const fieldNames = td.fields.map((f) => `\`${f.name}\``).join(', ');
      lines.push(
        `- **${td.name}** (${fieldNames}) — used by ${users.map((u) => u.name).join(', ')}`,
      );
    }
  }

  return lines;
}

/**
 * Formats a single field as a Prisma-style declaration line with type and attributes.
 */
function fieldDeclarationLine(field: DataField): string {
  let typeName = resolveTypeName(field.type);
  if (field.type.array) {
    typeName += '[]';
  }

  if (field.type.optional) {
    typeName += '?';
  }

  const attributes = (field.attributes ?? [])
    .filter((a) => {
      const name = getAttributeName(a);
      return name && !name.startsWith('@@@') && name !== '@meta';
    })
    .map((a) => `${getAttributeName(a)}${formatAttributeArgs(a)}`)
    .join(' ');

  const attributePart = attributes ? ` ${attributes}` : '';
  return `    ${field.name} ${typeName}${attributePart}`;
}

/**
 * Joins non-zero entity counts into a comma-separated summary string.
 */
function formatCountSummary(counts: SkillCounts): string {
  const parts: string[] = [];
  if (counts.models > 0) {
    parts.push(plural(counts.models, 'model'));
  }

  if (counts.views > 0) {
    parts.push(plural(counts.views, 'view'));
  }

  if (counts.types > 0) {
    parts.push(plural(counts.types, 'type'));
  }

  if (counts.enums > 0) {
    parts.push(plural(counts.enums, 'enum'));
  }

  if (counts.procedures > 0) {
    parts.push(plural(counts.procedures, 'procedure'));
  }

  return parts.join(', ');
}

// --- Analysis helpers ---

/**
 * Returns true if any model's access policy references `auth()`.
 */
function hasAuthRules(models: DataModel[]): boolean {
  return models.some((m) =>
    m.attributes.some((a) => {
      const name = a.decl.ref?.name;
      if (name !== '@@allow' && name !== '@@deny') {
        return false;
      }

      return a.args.some((argument) =>
        argument.$cstNode?.text?.includes('auth()'),
      );
    }),
  );
}

/**
 * Summarizes a model's relation fields as human-readable "field → Target (cardinality)" lines.
 */
function modelRelationLines(model: DataModel): string[] {
  const rels = model.fields.filter(
    (f) => f.type.reference?.ref && isDataModel(f.type.reference.ref),
  );
  if (rels.length === 0) {
    return [];
  }

  return rels
    .map((f) => {
      const ref = f.type.reference?.ref;
      if (!ref) {
        return '';
      }

      const card = f.type.array
        ? 'has many'
        : f.type.optional
          ? 'optional'
          : 'required';
      return `- ${f.name} → ${ref.name} (${card})`;
    })
    .filter(Boolean);
}

/**
 * Returns a pluralized count string (e.g. "3 models", "1 view").
 */
function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * Renders access policies and validation rules that agents must respect.
 */
function renderConstraints(models: DataModel[]): string[] {
  const modelsWithPolicies = models.filter((m) =>
    m.attributes.some((a) => {
      const name = a.decl.ref?.name;
      return name === '@@allow' || name === '@@deny';
    }),
  );

  const validationEntries: Array<{
    field: string;
    model: string;
    rule: string;
  }> = [];
  for (const model of models) {
    for (const field of model.fields) {
      for (const attribute of field.attributes) {
        const attributeDecl = attribute.decl.ref;
        if (!attributeDecl) {
          continue;
        }

        if (
          attributeDecl.attributes.some(
            (ia) => ia.decl.ref?.name === '@@@validation',
          )
        ) {
          validationEntries.push({
            field: field.name,
            model: model.name,
            rule: `${getAttributeName(attribute)}${formatAttributeArgs(attribute)}`,
          });
        }
      }
    }
  }

  if (modelsWithPolicies.length === 0 && validationEntries.length === 0) {
    return [];
  }

  const lines: string[] = [];
  lines.push('## Constraints You Must Respect');
  lines.push('');

  if (modelsWithPolicies.length > 0) {
    lines.push('### Access Policies');
    lines.push('');
    lines.push(
      'ZenStack enforces these rules at the ORM level. Your code does not need to re-implement them, but you must be aware of them when reasoning about what operations will succeed or fail.',
    );
    if (hasAuthRules(models)) {
      lines.push('');
      lines.push(
        '> Some rules reference `auth()` — the currently authenticated user. Operations that require `auth()` will fail for unauthenticated requests.',
      );
    }

    lines.push('');

    for (const model of modelsWithPolicies.sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const rules: string[] = [];
      for (const attribute of model.attributes) {
        const name = attribute.decl.ref?.name;
        if (name !== '@@allow' && name !== '@@deny') {
          continue;
        }

        const effect = name === '@@allow' ? 'allow' : 'deny';
        const args = attribute.args
          .map((a) => a.$cstNode?.text ?? '')
          .join(', ');
        rules.push(`${effect}(${args})`);
      }

      lines.push(`**${model.name}**: ${rules.join(' · ')}`);
      lines.push('');
    }
  }

  if (validationEntries.length > 0) {
    lines.push('### Validation');
    lines.push('');
    lines.push(
      'These constraints are enforced at the schema level. When generating test data, seed scripts, or form inputs, produce values that satisfy them.',
    );
    lines.push('');

    const byModel = new Map<string, Array<{ field: string; rule: string }>>();
    for (const entry of validationEntries) {
      const list = byModel.get(entry.model) ?? [];
      list.push({ field: entry.field, rule: entry.rule });
      byModel.set(entry.model, list);
    }

    for (const modelName of [...byModel.keys()].sort()) {
      const rules = byModel
        .get(modelName)!
        .map((r) => `${r.field}: ${r.rule}`)
        .join(', ');
      lines.push(`- **${modelName}**: ${rules}`);
    }

    lines.push('');
  }

  return lines;
}

/**
 * Renders detected schema conventions: ID strategy, mixins, computed fields, FK patterns.
 */
function renderConventions(models: DataModel[], typeDefs: TypeDef[]): string[] {
  const lines: string[] = [];
  lines.push('## Conventions');
  lines.push('');
  lines.push('Follow these patterns when working with this schema:');
  lines.push('');

  lines.push(`- **IDs**: ${detectIdConvention(models)}`);

  const mixinLines = detectMixins(models, typeDefs);
  if (mixinLines.length > 0) {
    lines.push('- **Mixins** (shared field sets applied via `with`):');
    for (const ml of mixinLines) {
      lines.push(`  ${ml}`);
    }
  }

  const computedFields = detectComputedFields(models);
  if (computedFields.length > 0) {
    lines.push(
      '- **Computed fields** are read-only and derived at the database level. Never set them directly:',
    );
    for (const cf of computedFields) {
      lines.push(`  ${cf}`);
    }
  }

  const modelsWithRelations = models.filter((m) =>
    m.fields.some(
      (f) => f.type.reference?.ref && isDataModel(f.type.reference.ref),
    ),
  );
  if (modelsWithRelations.length > 0) {
    const fkExamples = detectFKExamples(models);
    const fkExamplePart =
      fkExamples.length > 0
        ? ` (e.g. \`${fkExamples.slice(0, 3).join('`, `')}\`)`
        : '';
    lines.push(
      `- **Relations**: ${modelsWithRelations.length} of ${models.length} models have relationships. When creating records, always provide required foreign key fields${fkExamplePart}.`,
    );
  }

  lines.push('');
  return lines;
}

// --- Instructional sections ---

/**
 * Renders the full entity reference with Prisma declaration blocks and doc page links.
 */
function renderEntityReference(
  models: DataModel[],
  enums: Enum[],
  typeDefs: TypeDef[],
  views: DataModel[],
): string[] {
  const lines: string[] = [];
  lines.push('---');
  lines.push('');
  lines.push('## Entity Reference');
  lines.push('');

  if (models.length > 0) {
    lines.push('### Models');
    lines.push('');
    for (const model of [...models].sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      lines.push(`#### ${model.name}`);
      lines.push('');
      lines.push('```prisma');
      lines.push(...renderModelDeclaration(model, 'model'));
      lines.push('```');
      lines.push('');

      const rels = modelRelationLines(model);
      if (rels.length > 0) {
        lines.push('Relationships:');
        for (const r of rels) {
          lines.push(r);
        }

        lines.push('');
      }

      lines.push(`[${model.name} (Model)](./models/${model.name}.md)`);
      lines.push('');
    }
  }

  if (enums.length > 0) {
    lines.push('### Enums');
    lines.push('');
    for (const e of [...enums].sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`#### ${e.name}`);
      lines.push('');
      lines.push('```prisma');
      lines.push(...renderEnumDeclaration(e));
      lines.push('```');
      lines.push('');
      lines.push(`[${e.name} (Enum)](./enums/${e.name}.md)`);
      lines.push('');
    }
  }

  if (typeDefs.length > 0) {
    lines.push('### Types');
    lines.push('');
    for (const td of [...typeDefs].sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      lines.push(`#### ${td.name}`);
      lines.push('');
      lines.push('```prisma');
      lines.push(...renderTypeDeclaration(td));
      lines.push('```');
      lines.push('');
      lines.push(`[${td.name} (Type)](./types/${td.name}.md)`);
      lines.push('');
    }
  }

  if (views.length > 0) {
    lines.push('### Views');
    lines.push('');
    for (const view of [...views].sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      lines.push(`#### ${view.name}`);
      lines.push('');
      lines.push('```prisma');
      lines.push(...renderModelDeclaration(view, 'view'));
      lines.push('```');
      lines.push('');
      lines.push(`[${view.name} (View)](./views/${view.name}.md)`);
      lines.push('');
    }
  }

  return lines;
}

/**
 * Renders an enum declaration block with doc comments and values.
 */
function renderEnumDeclaration(e: Enum): string[] {
  const lines: string[] = [];
  const desc = stripCommentPrefix(e.comments);
  if (desc) {
    for (const dLine of desc.split('\n')) {
      lines.push(`/// ${dLine}`);
    }
  }

  lines.push(`enum ${e.name} {`);
  for (const field of e.fields) {
    const valueDesc = stripCommentPrefix(field.comments);
    if (valueDesc) {
      lines.push(`    /// ${valueDesc}`);
    }

    lines.push(`    ${field.name}`);
  }

  lines.push('}');
  return lines;
}

/**
 * Renders the footer with links to the full index and relationships pages.
 */
function renderFooter(hasRelationships: boolean): string[] {
  const lines: string[] = [];
  lines.push('---');
  lines.push('');
  lines.push('## Detailed Documentation');
  lines.push('');
  lines.push(
    'For Mermaid diagrams, formatted tables, and fully cross-linked pages:',
  );
  lines.push('');
  lines.push('- [Full schema index](./index.md)');
  if (hasRelationships) {
    lines.push('- [Relationships and ER diagrams](./relationships.md)');
  }

  lines.push('');
  return lines;
}

/**
 * Renders YAML frontmatter with the skill name and description.
 */
function renderFrontmatter(title: string): string[] {
  const slug = title
    .toLowerCase()
    .replaceAll(/[^\da-z]+/gu, '-')
    .replaceAll(/^-|-$/gu, '');
  return [
    '---',
    `name: ${slug}-schema`,
    `description: Schema reference for ${title}. Use when writing queries, building forms, creating or modifying models, generating API endpoints, writing tests with seed data, or reasoning about data access and validation in this project.`,
    '---',
    '',
  ];
}

/**
 * Renders a complete model/view declaration block with comments, fields, and attributes.
 */
function renderModelDeclaration(
  model: DataModel,
  keyword: 'model' | 'view',
): string[] {
  const lines: string[] = [];
  const desc = stripCommentPrefix(model.comments);
  if (desc) {
    for (const dLine of desc.split('\n')) {
      lines.push(`/// ${dLine}`);
    }
  }

  const mixinPart =
    model.mixins.length > 0
      ? ` with ${model.mixins
          .map((m) => m.ref?.name ?? '')
          .filter(Boolean)
          .join(', ')}`
      : '';

  lines.push(`${keyword} ${model.name}${mixinPart} {`);
  for (const field of model.fields) {
    const fieldDesc = stripCommentPrefix(field.comments);
    if (fieldDesc) {
      lines.push(`    /// ${fieldDesc}`);
    }

    lines.push(fieldDeclarationLine(field));
  }

  for (const attribute of model.attributes) {
    const name = attribute.decl.ref?.name;
    if (!name || name.startsWith('@@@')) {
      continue;
    }

    const args = attribute.args.map((a) => a.$cstNode?.text ?? '').join(', ');
    lines.push(`    ${name}(${args})`);
  }

  lines.push('}');
  return lines;
}

// --- Entity Reference ---

/**
 * Renders the schema overview section with entity counts and a categorized entity list.
 */
function renderOverview(
  title: string,
  counts: SkillCounts,
  models: DataModel[],
  views: DataModel[],
): string[] {
  const lines: string[] = [];
  lines.push(`# ${title} — Schema Skill`);
  lines.push('');
  lines.push(
    `This skill provides the data schema context for ${title}. Consult it whenever you need to understand the data model, write type-safe code against it, or respect its constraints.`,
  );
  lines.push('');
  lines.push('## Schema Overview');
  lines.push('');
  lines.push(`This schema contains ${formatCountSummary(counts)}.`);
  lines.push('');

  const allEntities = [...models, ...views].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  if (allEntities.length > 0) {
    lines.push('Entities:');
    for (const m of allEntities) {
      const desc = stripCommentPrefix(m.comments);
      const kind = m.isView ? 'View' : 'Model';
      const descPart = desc ? ` — ${desc.split('\n')[0]}` : '';
      lines.push(`- **${m.name}** (${kind})${descPart}`);
    }

    lines.push('');
  }

  return lines;
}

/**
 * Renders a type definition declaration block with fields and doc comments.
 */
function renderTypeDeclaration(td: TypeDef): string[] {
  const lines: string[] = [];
  const desc = stripCommentPrefix(td.comments);
  if (desc) {
    for (const dLine of desc.split('\n')) {
      lines.push(`/// ${dLine}`);
    }
  }

  lines.push(`type ${td.name} {`);
  for (const field of td.fields) {
    const fieldDesc = stripCommentPrefix(field.comments);
    if (fieldDesc) {
      lines.push(`    /// ${fieldDesc}`);
    }

    lines.push(fieldDeclarationLine(field));
  }

  lines.push('}');
  return lines;
}

/**
 * Renders step-by-step guidance for writing queries, calling procedures, and generating test data.
 */
function renderWorkflow(
  procedures: Procedure[],
  hasRelationships: boolean,
): string[] {
  const lines: string[] = [];
  lines.push('## How To Use This Schema');
  lines.push('');

  lines.push('### Writing queries or mutations');
  lines.push('');
  lines.push('1. Find the model in the Entity Reference below');
  lines.push('2. Check its fields for types, optionality, and defaults');
  lines.push(
    '3. Check access policies — will the operation be allowed for the current user?',
  );
  lines.push(
    '4. Check validation — will the input values pass schema-level validation?',
  );
  lines.push('5. For full field details, follow the entity documentation link');
  lines.push('');

  if (procedures.length > 0) {
    lines.push('### Calling procedures');
    lines.push('');
    lines.push(
      'This schema defines server-side procedures. Use them instead of writing raw queries when available:',
    );
    lines.push('');
    const sorted = [...procedures].sort((a, b) => a.name.localeCompare(b.name));
    for (const proc of sorted) {
      const kind = proc.mutation ? 'mutation' : 'query';
      const parameters = proc.params
        .map((p) => {
          let typeName = resolveTypeName(p.type);
          if (p.type.array) {
            typeName += '[]';
          }

          if (p.optional) {
            typeName += '?';
          }

          return `${p.name}: ${typeName}`;
        })
        .join(', ');
      let returnType = resolveTypeName(proc.returnType);
      if (returnType === 'Unknown') {
        returnType = 'Void';
      }

      if (proc.returnType.array) {
        returnType += '[]';
      }

      const desc = extractProcedureComments(proc, ' ');
      const descPart = desc ? ` — ${desc}` : '';
      lines.push(
        `- \`${proc.name}(${parameters}) → ${returnType}\` *(${kind})*${descPart} — [${proc.name} (Procedure)](./procedures/${proc.name}.md)`,
      );
    }

    lines.push('');
  }

  lines.push('### Generating test data');
  lines.push('');
  lines.push('When creating seed data or test fixtures:');
  lines.push('');
  lines.push(
    '- Respect `@unique` constraints — duplicate values will cause insert failures',
  );
  lines.push('- Satisfy validation rules (see Constraints above)');
  lines.push('- Provide all required foreign keys for relations');
  lines.push(
    '- Fields with `@default(...)` can be omitted — the database generates them',
  );
  lines.push('- Fields with `@computed` cannot be set — they are derived');
  lines.push('');

  if (hasRelationships) {
    lines.push('### Understanding relationships');
    lines.push('');
    lines.push(
      'See the [relationships page](./relationships.md) for a full ER diagram and cross-reference table.',
    );
    lines.push('');
  }

  return lines;
}
