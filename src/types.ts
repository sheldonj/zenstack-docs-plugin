import {
  type DataModel,
  type Enum,
  type Model,
  type Procedure,
  type TypeDef,
} from '@zenstackhq/language/ast';

/**
 * Metadata extracted from `@@meta` model-level attributes (e.g. `doc:category`, `doc:since`).
 */
export type DocMeta = {
  category?: string;
  deprecated?: string;
  since?: string;
};

export type EnumPageProps = {
  allModels: DataModel[];
  enumDecl: Enum;
  navigation?: Navigation;
  options: RenderOptions;
};

/**
 * Metadata captured during a generation run, rendered in index page footer.
 */
export type GenerationContext = {
  durationMs?: number;
  filesGenerated?: number;
  generatedAt: string;
  schemaFile: string;
};

export type IndexPageProps = {
  astModel: Model;
  genCtx?: GenerationContext;
  hasErdMmd?: boolean;
  hasErdSvg?: boolean;
  hasRelationships: boolean;
  pluginOptions: PluginOptions;
};

export type ModelPageProps = {
  allModels: DataModel[];
  model: DataModel;
  navigation?: Navigation;
  options: RenderOptions;
  procedures: Procedure[];
};

/**
 * Previous/next navigation links for entity pages within a category.
 */
export type Navigation = {
  next?: NavLink;
  prev?: NavLink;
};

/**
 * A link to an adjacent entity in a sorted navigation list.
 */
export type NavLink = {
  name: string;
  path: string;
};

/**
 * User-facing plugin options from the ZModel plugin block.
 */
export type PluginOptions = {
  diagramFormat?: 'both' | 'mermaid' | 'svg';
  erdFormat?: 'both' | 'mmd' | 'svg';
  erdTheme?: string;
  fieldOrder?: 'alphabetical' | 'declaration';
  generateErd?: boolean;
  generateSkill?: boolean;
  includeIndexes?: boolean;
  includeInternalModels?: boolean;
  includePolicies?: boolean;
  includeRelationships?: boolean;
  includeValidation?: boolean;
  output?: string;
  title?: string;
};

// ── Page Props ──────────────────────────────────────────────────────────

export type ProcedurePageProps = {
  navigation?: Navigation;
  options: RenderOptions;
  proc: Procedure;
};

/**
 * A single relationship between two data models.
 */
export type Relationship = {
  field: string;
  from: string;
  /**
   * The `@relation("name")` value, if present. Used for deduplication across relationship sides.
   */
  relationName?: string;
  to: string;
  type: RelationType;
};

export type RelationshipsPageProps = {
  genCtx?: GenerationContext;
  relations: Relationship[];
};

/**
 * Cardinality of a relationship, inferred from field type properties and FK uniqueness.
 */
export type RelationType =
  | 'Many→Many'
  | 'Many→One?'
  | 'Many→One'
  | 'One→Many'
  | 'One→One?'
  | 'One→One';

/**
 * Controls which optional sections are included in the generated documentation pages.
 */
export type RenderOptions = {
  fieldOrder: 'alphabetical' | 'declaration';
  /**
   * Metadata about the current generation run (timestamps, file counts).
   */
  genCtx?: GenerationContext;
  includeIndexes: boolean;
  includePolicies: boolean;
  includeRelationships: boolean;
  includeValidation: boolean;
  /**
   * Absolute path to the directory containing the source schema file(s), used for relative source path display.
   */
  schemaDir?: string;
};

export type SkillPageProps = {
  enums: Enum[];
  hasRelationships: boolean;
  models: DataModel[];
  procedures: Procedure[];
  schema: Model;
  title: string;
  typeDefs: TypeDef[];
  views: DataModel[];
};

export type TypePageProps = {
  allModels: DataModel[];
  navigation?: Navigation;
  options: RenderOptions;
  typeDef: TypeDef;
};

export type ViewPageProps = {
  navigation?: Navigation;
  options: RenderOptions;
  view: DataModel;
};
