import {
  type DocMeta,
  type PluginOptions,
  type Relationship,
  type RelationType,
  type RenderOptions,
} from './types';
import {
  type DataField,
  type DataFieldAttribute,
  type DataModel,
  type DataModelAttribute,
  isDataModel,
  isEnum,
  isTypeDef,
} from '@zenstackhq/language/ast';
import { getAllFields } from '@zenstackhq/language/utils';
import path from 'node:path';

/**
 * Structural shape for both DataFieldType and FunctionParamType.
 */
export type TypeLike = {
  array?: boolean;
  optional?: boolean;
  reference?: { readonly ref?: { readonly name: string } };
  type?: string;
};

type AstLike = {
  $container?: AstLike;
  $cstNode?: {
    root?: { element?: { $document?: { uri?: { fsPath?: string } } } };
  };
  $document?: { uri?: { fsPath?: string } };
};

/**
 * Extracts the set of foreign key field names from `@relation(fields: [...])` attributes.
 */
export function collectFKFieldNames(fields: DataField[]): Set<string> {
  const fkNames = new Set<string>();
  for (const field of fields) {
    const relationAttribute = field.attributes.find(
      (a) => getAttrName(a) === '@relation',
    );
    if (!relationAttribute) {
      continue;
    }

    const cstText = relationAttribute.$cstNode?.text ?? '';
    const fieldsMatch = cstText.match(/fields:\s*\[([^\]]+)\]/u);
    if (fieldsMatch) {
      for (const name of fieldsMatch[1]!.split(',').map((s) => s.trim())) {
        fkNames.add(name);
      }
    }
  }

  return fkNames;
}

/**
 * Collects all relation fields across the given models into a flat list of `Relationship` entries.
 */
export function collectRelationships(models: DataModel[]): Relationship[] {
  const modelByName = new Map<string, DataModel>();
  for (const m of models) {
    modelByName.set(m.name, m);
  }

  const rels: Relationship[] = [];
  for (const model of models) {
    for (const field of getAllFields(model)) {
      if (field.type.reference?.ref && isDataModel(field.type.reference.ref)) {
        const targetModel = modelByName.get(field.type.reference.ref.name);
        if (!targetModel) {
          continue;
        }

        const relType = inferRelationType(field, model, targetModel);
        const relName = getRelationName(field);
        rels.push({
          field: field.name,
          from: model.name,
          relationName: relName,
          to: targetModel.name,
          type: relType,
        });
      }
    }
  }

  return rels;
}

/**
 * Extracts `@@meta('doc:category', ...)`, `doc:since`, and `doc:deprecated` values from model attributes.
 */
export function extractDocMeta(attributes: DataModelAttribute[]): DocMeta {
  const meta: DocMeta = {};
  for (const attribute of attributes) {
    if (attribute.decl.ref?.name !== '@@meta') {
      continue;
    }

    const key = stripQuotes(attribute.args[0]?.$cstNode?.text ?? '');
    const value = stripQuotes(attribute.args[1]?.$cstNode?.text ?? '');

    if (key === 'doc:category') {
      meta.category = value;
    } else if (key === 'doc:since') {
      meta.since = value;
    } else if (key === 'doc:deprecated') {
      meta.deprecated = value;
    }
  }

  return meta;
}

/**
 * Extracts the `@meta('doc:example', '...')` value from a field, if present.
 */
export function extractFieldDocExample(field: DataField): string | undefined {
  for (const attribute of field.attributes) {
    if (getAttrName(attribute) !== '@meta') {
      continue;
    }

    const key = stripQuotes(attribute.args[0]?.$cstNode?.text ?? '');
    if (key === 'doc:example') {
      return stripQuotes(attribute.args[1]?.$cstNode?.text ?? '');
    }
  }

  return undefined;
}

/**
 * Extracts `///` doc-comments preceding a procedure declaration from its CST text.
 * Returns the comments joined by `joinWith` (newline by default, space for inline use).
 */
export function extractProcedureComments(
  proc: { $cstNode?: { text?: string } },
  joinWith: ' ' | '\n' = '\n',
): string {
  const cstText = proc.$cstNode?.text;
  if (!cstText) {
    return '';
  }

  const commentLines: string[] = [];
  for (const line of cstText.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('///')) {
      commentLines.push(trimmed.replace(/^\/{3}\s?/u, ''));
    } else {
      break;
    }
  }

  return commentLines.join(joinWith).trim();
}

/**
 * Formats the argument list of a field attribute as a parenthesized string, e.g. `(cuid())`.
 */
export function formatAttrArgs(attribute: DataFieldAttribute): string {
  if (attribute.args.length === 0) {
    return '';
  }

  const parts = attribute.args.map((argument) => argument.$cstNode?.text ?? '');
  return `(${parts.join(', ')})`;
}

/**
 * Returns the resolved name of a field-level attribute (e.g. `@id`, `@default`).
 */
export function getAttrName(attribute: DataFieldAttribute): string {
  return attribute.decl.ref?.name ?? '';
}

/**
 * Returns the formatted default value for a field, or an em-dash if none.
 */
export function getDefaultValue(field: DataField): string {
  const defaultAttribute = field.attributes.find(
    (a) => getAttrName(a) === '@default',
  );
  const firstArgument = defaultAttribute?.args[0];
  if (!firstArgument) {
    return '\u2014';
  }

  return `\`${firstArgument.$cstNode?.text ?? ''}\``;
}

/**
 * Returns a comma-separated string of field attributes, excluding `@default`, `@computed`, and `@meta`.
 */
export function getFieldAttributes(field: DataField): string {
  const attributes = field.attributes
    .filter((a) => {
      const name = getAttrName(a);
      return name !== '@default' && name !== '@computed' && name !== '@meta';
    })
    .map((a) => `\`${getAttrName(a)}${formatAttrArgs(a)}\``);
  return attributes.length > 0 ? attributes.join(', ') : '\u2014';
}

/**
 * Returns the display string for a field's type, optionally linking to the related model/enum page.
 * Model field links use relative `./` paths (caller is in models/ dir).
 */
export function getFieldTypeName(field: DataField, linked: boolean): string {
  let typeName: string;
  if (field.type.reference?.ref) {
    const ref = field.type.reference.ref;
    if (linked) {
      if (isDataModel(ref)) {
        typeName = `[${ref.name}](./${ref.name}.md)`;
      } else if (isEnum(ref)) {
        typeName = `[${ref.name}](../enums/${ref.name}.md)`;
      } else {
        typeName = ref.name;
      }
    } else {
      typeName = ref.name;
    }
  } else if (field.type.type) {
    typeName = field.type.type;
  } else {
    typeName = 'Unknown';
  }

  if (field.type.array) {
    typeName += '[]';
  }

  if (field.type.optional) {
    typeName += '?';
  }

  const isScalar = !field.type.reference?.ref;
  return isScalar ? `\`${typeName}\`` : typeName;
}

/**
 * Extracts the relation name from `@relation("Name", ...)`, or undefined if absent.
 */
export function getRelationName(field: DataField): string | undefined {
  const attribute = field.attributes.find(
    (a) => getAttrName(a) === '@relation',
  );
  if (!attribute) {
    return undefined;
  }

  const cstText = attribute.$cstNode?.text ?? '';
  const m = cstText.match(/@relation\(\s*"([^"]+)"/u);
  return m?.[1];
}

/**
 * Returns the source file path relative to `schemaDir`, or just the basename if `schemaDir` is not set.
 */
export function getRelativeSourcePath(
  node: AstLike,
  schemaDir: string | undefined,
): string | undefined {
  const absPath = getSourceFilePath(node);
  if (!absPath) {
    return undefined;
  }

  return schemaDir ? path.relative(schemaDir, absPath) : path.basename(absPath);
}

/**
 * Resolves the absolute file system path of the source file that defines `node`.
 */
export function getSourceFilePath(node: AstLike): string | undefined {
  const cstDocument = node.$cstNode?.root?.element?.$document?.uri?.fsPath;
  if (cstDocument) {
    return cstDocument;
  }

  let root: AstLike = node;
  while (root.$container) {
    root = root.$container;
  }

  return root.$document?.uri?.fsPath;
}

/**
 * Returns `true` if the field is non-optional and non-array (i.e. required for creation).
 */
export function isFieldRequired(field: DataField): boolean {
  return !field.type.optional && !field.type.array;
}

/**
 * Returns `true` if the model has the `@@ignore` attribute.
 */
export function isIgnoredModel(model: DataModel): boolean {
  return model.attributes.some((a) => a.decl.ref?.name === '@@ignore');
}

/**
 * Converts plugin options into a typed `RenderOptions` with defaults.
 */
export function resolveRenderOptions(options: PluginOptions): RenderOptions {
  return {
    fieldOrder:
      options.fieldOrder === 'alphabetical' ? 'alphabetical' : 'declaration',
    includeGeneratedHeader: options.includeGeneratedHeader !== false,
    includeIndexes: options.includeIndexes !== false,
    includePolicies: options.includePolicies !== false,
    includeRelationships: options.includeRelationships !== false,
    includeValidation: options.includeValidation !== false,
  };
}

/**
 * Returns a markdown-formatted type link for use in documentation tables.
 * When `linked` is true, reference types are rendered as markdown links to their pages.
 * Scalar types are wrapped in backticks; array/optional suffixes are appended.
 */
export function resolveTypeLink(t: TypeLike, linked: boolean): string {
  let typeName: string;
  if (t.reference?.ref) {
    const ref: unknown = t.reference.ref;
    if (linked) {
      if (isDataModel(ref)) {
        typeName = `[${ref.name}](../models/${ref.name}.md)`;
      } else if (isEnum(ref)) {
        typeName = `[${ref.name}](../enums/${ref.name}.md)`;
      } else if (isTypeDef(ref)) {
        typeName = `[${ref.name}](../types/${ref.name}.md)`;
      } else {
        typeName = t.reference.ref.name;
      }
    } else {
      typeName = t.reference.ref.name;
    }
  } else if (t.type) {
    typeName = t.type;
  } else {
    typeName = 'Unknown';
  }

  if (t.array) {
    typeName += '[]';
  }

  if (t.optional) {
    typeName += '?';
  }

  const isScalar = !t.reference?.ref;
  return isScalar ? `\`${typeName}\`` : typeName;
}

/**
 * Returns the bare type name string (e.g. `"String"`, `"User"`) without markdown formatting.
 */
export function resolveTypeName(t: TypeLike): string {
  return t.reference?.ref?.name ?? t.type ?? 'Unknown';
}

/**
 * Strips leading `///` prefixes from ZModel doc-comment lines and joins them.
 */
export function stripCommentPrefix(comments: string[]): string {
  return comments
    .map((c) => c.replace(/^\/{3}\s?/u, ''))
    .join('\n')
    .trim();
}

/**
 * Removes surrounding single or double quotes from a CST argument string.
 */
export function stripQuotes(s: string): string {
  return s.replaceAll(/^["']|["']$/gu, '');
}

/**
 * Finds the inverse (back-reference) field on `targetModel` that participates in the same relation as `field`.
 */
function findBackRef(
  field: DataField,
  model: DataModel,
  targetModel: DataModel,
  filter: (f: DataField) => boolean,
): DataField | undefined {
  const relName = getRelationName(field);
  return getAllFields(targetModel, true).find((f) => {
    if (f === field) {
      return false;
    }

    if (!f.type.reference?.ref || !isDataModel(f.type.reference.ref)) {
      return false;
    }

    if (f.type.reference.ref.name !== model.name) {
      return false;
    }

    if (relName && getRelationName(f) !== relName) {
      return false;
    }

    return filter(f);
  });
}

/**
 * Returns the FK field names declared in a `@relation(fields: [...])` attribute on `field`.
 */
function getRelationFKNames(field: DataField): string[] {
  const relationAttribute = field.attributes.find(
    (a) => getAttrName(a) === '@relation',
  );
  if (!relationAttribute) {
    return [];
  }

  const cstText = relationAttribute.$cstNode?.text ?? '';
  const match = cstText.match(/fields:\s*\[([^\]]+)\]/u);
  if (!match) {
    return [];
  }

  return match[1]!.split(',').map((s) => s.trim());
}

/**
 * Returns true if `field` has a `@relation(fields: [...])` where all FK columns are `@unique`.
 */
function hasUniqueForeignKey(field: DataField, model: DataModel): boolean {
  const fkNames = getRelationFKNames(field);
  if (fkNames.length === 0) {
    return false;
  }

  const allFields = getAllFields(model, true);
  return fkNames.every((fkName) => {
    const fkField = allFields.find((f) => f.name === fkName);
    return fkField?.attributes.some((a) => getAttrName(a) === '@unique');
  });
}

/**
 * Determines the cardinality of a relation field by inspecting FK uniqueness,
 * array types, and the inverse field on the target model.
 */
function inferRelationType(
  field: DataField,
  model: DataModel,
  targetModel: DataModel,
): RelationType {
  if (field.type.array) {
    if (isImplicitManyToManySide(field)) {
      const arrayBackRef = findBackRef(
        field,
        model,
        targetModel,
        (f) => f.type.array,
      );
      if (arrayBackRef && isImplicitManyToManySide(arrayBackRef)) {
        return 'Many\u2192Many';
      }
    }

    return 'One\u2192Many';
  }

  if (hasUniqueForeignKey(field, model)) {
    return field.type.optional ? 'One\u2192One?' : 'One\u2192One';
  }

  const scalarBackRef = findBackRef(
    field,
    model,
    targetModel,
    (f) => !f.type.array,
  );
  if (scalarBackRef && hasUniqueForeignKey(scalarBackRef, targetModel)) {
    return field.type.optional ? 'One\u2192One?' : 'One\u2192One';
  }

  return field.type.optional ? 'Many\u2192One?' : 'Many\u2192One';
}

/**
 * Returns true if `field` is an array relation with no explicit FK (implicit join table side).
 */
function isImplicitManyToManySide(field: DataField): boolean {
  return field.type.array && getRelationFKNames(field).length === 0;
}
