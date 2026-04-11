import {
  collectFKFieldNames,
  collectRelationships,
  extractDocMeta,
  extractFieldDocExample as extractFieldDocumentExample,
  getAttrName,
  getDefaultValue,
  getFieldAttributes,
  getFieldTypeName,
  getRelativeSourcePath,
  isFieldRequired,
  resolveTypeName,
  stripCommentPrefix,
  stripQuotes,
} from '../extractors';
import { type ModelPageProps } from '../types';
import {
  breadcrumbs,
  declarationBlock,
  generatedHeader,
  navigationFooter,
  referencesSection,
  renderDescription,
  renderMetadata,
  sectionHeading,
} from './common';
import { relationDedupKey, relationToMermaid } from './erd';
import {
  type DataField,
  type DataModel,
  type DataModelAttribute,
  isDataModel,
  isTypeDef,
  type Procedure,
  type TypeDef,
} from '@zenstackhq/language/ast';
import { getAllFields } from '@zenstackhq/language/utils';

type ValidationRule = {
  fieldName: string;
  rule: string;
};

/**
 * Collects field-level validation attributes and model-level `@@validate` rules.
 */
function collectValidationRules(
  orderedFields: DataField[],
  modelAttrs: DataModelAttribute[],
): ValidationRule[] {
  const rules: ValidationRule[] = [];

  for (const field of orderedFields) {
    for (const attribute of field.attributes) {
      const attrDecl = attribute.decl.ref;
      if (!attrDecl) {
        continue;
      }

      const isValidation = attrDecl.attributes.some(
        (ia) => ia.decl.ref?.name === '@@@validation',
      );
      if (isValidation) {
        rules.push({
          fieldName: field.name,
          rule: `\`${getAttrName(attribute)}\``,
        });
      }
    }
  }

  const validateAttrs = modelAttrs.filter(
    (a) => a.decl.ref?.name === '@@validate',
  );
  for (const attribute of validateAttrs) {
    const condition = attribute.args[0]?.$cstNode?.text ?? '';
    const messageArg = attribute.args[1]?.$cstNode?.text
      ? stripQuotes(attribute.args[1].$cstNode.text)
      : undefined;
    const pathArg = attribute.args[2]?.$cstNode?.text
      ? stripQuotes(attribute.args[2].$cstNode.text)
      : undefined;

    const fieldName = pathArg ?? 'Model';
    let ruleText = `\`${condition}\``;
    if (messageArg) {
      ruleText += ` — *${messageArg}*`;
    }

    rules.push({ fieldName, rule: ruleText });
  }

  return rules;
}

/**
 * Returns true if any of the procedure's params or return type reference the given model.
 */
function isModelReferencedByProc(proc: Procedure, modelName: string): boolean {
  if (proc.returnType.reference?.ref?.name === modelName) {
    return true;
  }

  if (proc.returnType.type === modelName) {
    return true;
  }

  for (const parameter of proc.params) {
    if (parameter.type.reference?.ref?.name === modelName) {
      return true;
    }

    if (parameter.type.type === modelName) {
      return true;
    }
  }

  return false;
}

// ── Section renderers ───────────────────────────────────────────────────

/**
 * Renders the page header with badges for auth, delegate, and deprecation status.
 */
function renderHeader(props: ModelPageProps): string[] {
  const documentMeta = extractDocMeta(props.model.attributes);
  const isDeprecated = Boolean(documentMeta.deprecated);
  const nameDisplay = isDeprecated
    ? `~~${props.model.name}~~`
    : props.model.name;

  const badgeParts = ['<kbd>Model</kbd>'];
  const hasAuth = props.model.attributes.some(
    (a) => a.decl.ref?.name === '@@auth',
  );
  const hasDelegate = props.model.attributes.some(
    (a) => a.decl.ref?.name === '@@delegate',
  );
  if (hasAuth) {
    badgeParts.push('<kbd>Auth</kbd>');
  }

  if (hasDelegate) {
    badgeParts.push('<kbd>Delegate</kbd>');
  }

  if (isDeprecated) {
    badgeParts.push('<kbd>Deprecated</kbd>');
  }

  return [
    ...generatedHeader(
      props.options.genCtx,
      props.options.includeGeneratedHeader,
    ),
    breadcrumbs('Models', props.model.name, '../'),
    '',
    `# 🗃️ ${nameDisplay} ${badgeParts.join(' ')}`,
    '',
  ];
}

/**
 * Renders doc metadata (category, since, source path) and a collapsible declaration block.
 */
function renderMetadataBlock(props: ModelPageProps): string[] {
  const documentMeta = extractDocMeta(props.model.attributes);
  const sourcePath = getRelativeSourcePath(
    props.model,
    props.options.schemaDir,
  );

  const mapAttr = props.model.attributes.find(
    (a) => a.decl.ref?.name === '@@map',
  );
  const schemaAttr = props.model.attributes.find(
    (a) => a.decl.ref?.name === '@@schema',
  );
  const mappedTable = mapAttr?.args[0]?.$cstNode?.text
    ? stripQuotes(mapAttr.args[0].$cstNode.text)
    : undefined;
  const dbSchema = schemaAttr?.args[0]?.$cstNode?.text
    ? stripQuotes(schemaAttr.args[0].$cstNode.text)
    : undefined;

  const decl = declarationBlock(props.model.$cstNode?.text, sourcePath);
  return [
    ...renderMetadata(documentMeta, sourcePath, { dbSchema, mappedTable }),
    ...(decl.length > 0 ? ['---', '', ...decl] : []),
  ];
}

const MAX_RELATED_FIELDS = 10;

/**
 * Renders a full documentation page for a data model, including fields, relationships, policies, validation, and procedures.
 */
export function renderModelPage(props: ModelPageProps): string {
  const { model, options, procedures } = props;
  const allFields = getAllFields(model, true);

  const orderedFields =
    options.fieldOrder === 'alphabetical'
      ? [...allFields].sort((a, b) => a.name.localeCompare(b.name))
      : [...allFields];

  const relationFields = allFields
    .filter((f) => f.type.reference?.ref && isDataModel(f.type.reference.ref))
    .sort((a, b) => a.name.localeCompare(b.name));

  const policyAttributes = model.attributes.filter((a) => {
    const name = a.decl.ref?.name ?? '';
    return name === '@@allow' || name === '@@deny';
  });

  const indexAttributes = model.attributes.filter((a) => {
    const name = a.decl.ref?.name ?? '';
    return name === '@@index' || name === '@@unique' || name === '@@id';
  });

  const validationRules = collectValidationRules(
    orderedFields,
    model.attributes,
  );

  const mixinRefs = model.mixins
    .map((ref) => ref.ref)
    .filter((t): t is NonNullable<typeof t> => t != null)
    .sort((a, b) => a.name.localeCompare(b.name));

  const sections: string[] = [];
  if (mixinRefs.length > 0) {
    sections.push('Mixins');
  }

  if (orderedFields.length > 0) {
    sections.push('Fields');
  }

  if (options.includeRelationships && relationFields.length > 0) {
    sections.push('Relationships');
  }

  if (options.includePolicies && policyAttributes.length > 0) {
    sections.push('Access Policies');
  }

  if (options.includeIndexes && indexAttributes.length > 0) {
    sections.push('Indexes');
  }

  if (options.includeValidation && validationRules.length > 0) {
    sections.push('Validation Rules');
  }

  const referencingProcs = procedures.filter((p) =>
    isModelReferencedByProc(p, model.name),
  );
  if (referencingProcs.length > 0) {
    sections.push('Used in Procedures');
  }

  return [
    ...renderHeader(props),
    ...renderDescription(model.comments),
    ...renderMetadataBlock(props),
    ...renderTableOfContents(sections),
    ...renderMixinsSection(mixinRefs),
    ...renderFieldsSection(model, orderedFields),
    ...(options.includeRelationships
      ? renderRelationshipsSection(
          model,
          [...allFields],
          relationFields,
          props.allModels,
        )
      : []),
    ...(options.includePolicies ? renderPoliciesSection(policyAttributes) : []),
    ...(options.includeIndexes ? renderIndexesSection(indexAttributes) : []),
    ...(options.includeValidation
      ? renderValidationSection(validationRules)
      : []),
    ...renderProceduresSection(procedures, model.name),
    ...referencesSection('model'),
    ...navigationFooter(props.navigation),
  ].join('\n');
}

/**
 * Renders the 7-column fields table with type links, defaults, attributes, and source info.
 */
function renderFieldsSection(
  model: DataModel,
  orderedFields: DataField[],
): string[] {
  if (orderedFields.length === 0) {
    return [];
  }

  const lines = [
    ...sectionHeading('Fields'),
    '',
    '| Field | Type | Required | Default | Attributes | Source | Description |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (const field of orderedFields) {
    const fieldDescription = stripCommentPrefix(field.comments);
    const isComputed = field.attributes.some(
      (a) => getAttrName(a) === '@computed',
    );
    const isIgnored = field.attributes.some(
      (a) => getAttrName(a) === '@ignore',
    );
    const inheritedFrom =
      isDataModel(field.$container) && field.$container !== model
        ? field.$container.name
        : undefined;
    const fromMixin = isTypeDef(field.$container)
      ? field.$container.name
      : undefined;

    let source = '—';
    if (fromMixin) {
      source = `[${fromMixin}](../types/${fromMixin}.md)`;
    } else if (inheritedFrom) {
      source = `[${inheritedFrom}](./${inheritedFrom}.md)`;
    }

    let typeCol = getFieldTypeName(field, true);
    if (isComputed) {
      typeCol += ' <kbd>computed</kbd>';
    }

    if (isIgnored) {
      typeCol += ' <kbd>ignored</kbd>';
    }

    const descParts: string[] = [];
    const example = extractFieldDocumentExample(field);
    if (example) {
      descParts.push(`Example: \`${example}\``);
    }

    if (fieldDescription) {
      descParts.push(fieldDescription);
    }

    const desc = descParts.length > 0 ? descParts.join(' ') : '—';
    const fieldAnchor = `<a id="field-${field.name}"></a>`;
    lines.push(
      `| ${fieldAnchor}\`${field.name}\` | ${typeCol} | ${isFieldRequired(field) ? 'Yes' : 'No'} | ${getDefaultValue(field)} | ${getFieldAttributes(field)} | ${source} | ${desc} |`,
    );
  }

  lines.push('');
  return lines;
}

/**
 * Renders `@@index`, `@@unique`, and `@@id` attributes as a fields/type table.
 */
function renderIndexesSection(indexAttributes: DataModelAttribute[]): string[] {
  if (indexAttributes.length === 0) {
    return [];
  }

  const lines = [
    ...sectionHeading('Indexes'),
    '',
    '| Fields | Type |',
    '| --- | --- |',
  ];
  for (const attribute of indexAttributes) {
    const attributeName = attribute.decl.ref?.name ?? '';
    let indexType: string;
    if (attributeName === '@@unique') {
      indexType = 'Unique';
    } else if (attributeName === '@@id') {
      indexType = 'Primary';
    } else {
      indexType = 'Index';
    }

    const fieldsArgument = attribute.args[0]?.$cstNode?.text ?? '';
    lines.push(`| \`${fieldsArgument}\` | ${indexType} |`);
  }

  lines.push('');
  return lines;
}

/**
 * Renders a list of mixins applied to this model with links to their type pages.
 */
function renderMixinsSection(mixinReferences: TypeDef[]): string[] {
  if (mixinReferences.length === 0) {
    return [];
  }

  const lines = [...sectionHeading('Mixins'), ''];
  for (const mixin of mixinReferences) {
    lines.push(`- [${mixin.name}](../types/${mixin.name}.md)`);
  }

  lines.push('');
  return lines;
}

/**
 * Renders `@@allow` and `@@deny` rules as an operation/rule/effect table.
 */
function renderPoliciesSection(
  policyAttributes: DataModelAttribute[],
): string[] {
  if (policyAttributes.length === 0) {
    return [];
  }

  return [
    ...sectionHeading('Access Policies'),
    '',
    '> [!IMPORTANT]',
    '> Operations are **denied by default**. `@@allow` rules grant access; `@@deny` rules override any allow.',
    '',
    '| Operation | Rule | Effect |',
    '| --- | --- | --- |',
    ...policyAttributes.map((attribute) => {
      const effect = attribute.decl.ref?.name === '@@allow' ? 'Allow' : 'Deny';
      const operationArgument = attribute.args[0]?.$cstNode?.text ?? '';
      const operation = stripQuotes(operationArgument);
      const condition = attribute.args[1]?.$cstNode?.text ?? '';
      return `| ${operation} | \`${condition}\` | ${effect} |`;
    }),
    '',
  ];
}

/**
 * Renders links to procedures that reference this model in their params or return type.
 */
function renderProceduresSection(
  procedures: Procedure[],
  modelName: string,
): string[] {
  const referenced = procedures
    .filter((p) => isModelReferencedByProc(p, modelName))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (referenced.length === 0) {
    return [];
  }

  const lines = [...sectionHeading('Used in Procedures'), ''];
  for (const proc of referenced) {
    const kind = proc.mutation ? 'mutation' : 'query';
    lines.push(`- [${proc.name}](../procedures/${proc.name}.md) — *${kind}*`);
  }

  lines.push('');
  return lines;
}

/**
 * Renders non-relation fields inside a Mermaid ER entity block, capped at 10 fields.
 */
function renderRelatedEntityFields(model: DataModel): string[] {
  const fields = getAllFields(model, true).filter(
    (f) => !(f.type.reference?.ref && isDataModel(f.type.reference.ref)),
  );
  const capped = fields.slice(0, MAX_RELATED_FIELDS);
  const lines: string[] = [`    ${model.name} {`];
  for (const field of capped) {
    lines.push(`        ${resolveTypeName(field.type)} ${field.name}`);
  }

  lines.push('    }');
  if (fields.length > MAX_RELATED_FIELDS) {
    const remaining = fields.length - MAX_RELATED_FIELDS;
    lines.push(`    %% … and ${remaining} more fields`);
  }

  return lines;
}

/**
 * Renders the relationships table and a Mermaid ER diagram with PK/FK/UK annotations.
 */
function renderRelationshipsSection(
  model: DataModel,
  allFields: DataField[],
  relationFields: DataField[],
  allModels: DataModel[],
): string[] {
  if (relationFields.length === 0) {
    return [];
  }

  const modelName = model.name;
  const fkNames = collectFKFieldNames(allFields);
  const scalarFields = allFields.filter(
    (f) => !(f.type.reference?.ref && isDataModel(f.type.reference.ref)),
  );

  const modelRels = collectRelationships(allModels).filter(
    (r) => r.from === modelName,
  );

  const lines = [
    ...sectionHeading('Relationships'),
    '',
    '| Field | Related Model | Type |',
    '| --- | --- | --- |',
  ];
  const seenPairs = new Set<string>();
  const relConnections: string[] = [];
  const relatedEntityBlocks: string[] = [];

  for (const field of relationFields) {
    const relatedModel = field.type.reference?.ref?.name ?? '';
    const relatedRef = field.type.reference?.ref;
    const rel = modelRels.find((r) => r.field === field.name);
    const relType =
      rel?.type ??
      (field.type.array
        ? 'One\u2192Many'
        : field.type.optional
          ? 'Many\u2192One?'
          : 'Many\u2192One');
    lines.push(
      `| \`${field.name}\` | [${relatedModel}](./${relatedModel}.md) | ${relType} |`,
    );

    const pairKey = rel
      ? relationDedupKey(rel)
      : `${[modelName, relatedModel].sort().join('--')}::${field.name}`;
    if (!seenPairs.has(pairKey)) {
      seenPairs.add(pairKey);
      if (rel) {
        relConnections.push(relationToMermaid(rel));
      }

      if (relatedRef && isDataModel(relatedRef)) {
        relatedEntityBlocks.push(...renderRelatedEntityFields(relatedRef));
      }
    }
  }

  lines.push('');

  const mermaidLines = ['```mermaid', 'erDiagram', `    ${modelName} {`];
  for (const field of scalarFields) {
    const typeName = resolveTypeName(field.type);
    const hasId = field.attributes.some((a) => getAttrName(a) === '@id');
    const hasUnique = field.attributes.some(
      (a) => getAttrName(a) === '@unique',
    );
    let annotation = '';
    if (hasId) {
      annotation = ' PK';
    } else if (hasUnique) {
      annotation = ' UK';
    } else if (fkNames.has(field.name)) {
      annotation = ' FK';
    }

    mermaidLines.push(`        ${typeName} ${field.name}${annotation}`);
  }

  mermaidLines.push('    }');
  mermaidLines.push(...relatedEntityBlocks);
  mermaidLines.push(...relConnections);
  mermaidLines.push('```', '');
  lines.push(...mermaidLines);

  return lines;
}

/**
 * Renders an inline table of contents linking to each section on the page.
 */
function renderTableOfContents(sections: string[]): string[] {
  if (sections.length <= 1) {
    return [];
  }

  const tocLinks = sections.map((s) => {
    const anchor = s.toLowerCase().replaceAll(/\s+/gu, '-');
    return `[${s}](#${anchor})`;
  });
  return [`> **On this page:** ${tocLinks.join(' · ')}`, ''];
}

// ── Main composition ────────────────────────────────────────────────────

/**
 * Renders field-level and model-level validation rules as a table.
 */
function renderValidationSection(rules: ValidationRule[]): string[] {
  if (rules.length === 0) {
    return [];
  }

  const lines = [
    ...sectionHeading('Validation Rules'),
    '',
    '| Field | Rule |',
    '| --- | --- |',
  ];
  for (const { fieldName, rule } of rules) {
    const nameCol = fieldName === 'Model' ? fieldName : `\`${fieldName}\``;
    lines.push(`| ${nameCol} | ${rule} |`);
  }

  lines.push('');
  return lines;
}
