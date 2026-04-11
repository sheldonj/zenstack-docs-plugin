import {
  collectRelationships,
  isIgnoredModel,
  resolveRenderOptions,
} from './extractors';
import { buildNavList } from './renderers/common';
import { processDiagrams } from './renderers/diagram-processor';
import { renderEnumPage } from './renderers/enum-page';
import { buildFullErDiagram, renderErdSvg } from './renderers/erd';
import { renderIndexPage } from './renderers/index-page';
import { renderModelPage } from './renderers/model-page';
import { renderProcedurePage } from './renderers/procedure-page';
import { renderRelationshipsPage } from './renderers/relationships-page';
import { renderSkillPage } from './renderers/skill-page';
import { renderTypePage } from './renderers/type-page';
import { renderViewPage } from './renderers/view-page';
import { type GenerationContext, type PluginOptions } from './types';
import {
  isDataModel,
  isEnum,
  isProcedure,
  isTypeDef,
} from '@zenstackhq/language/ast';
import { type CliGeneratorContext } from '@zenstackhq/sdk';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Main entry point for the documentation generator plugin.
 * Reads the ZModel AST from `context`, renders markdown pages for every entity,
 * and writes them into the configured output directory.
 */
export async function generate(context: CliGeneratorContext): Promise<void> {
  const startTime = performance.now();
  const pluginOptions = resolvePluginOptions(context.pluginOptions);
  const outputDir = resolveOutputDir(pluginOptions, context.defaultOutputPath);
  const options = resolveRenderOptions(pluginOptions);
  options.schemaDir = path.dirname(path.resolve(context.schemaFile));

  const genCtx: GenerationContext = {
    generatedAt: new Date().toISOString().split('T')[0]!,
    schemaFile: path.basename(context.schemaFile),
  };
  options.genCtx = genCtx;

  try {
    fs.mkdirSync(outputDir, { recursive: true });
  } catch (error) {
    throw new Error(
      `Failed to create output directory "${outputDir}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  let filesGenerated = 0;
  const diagFmt = pluginOptions.diagramFormat ?? 'mermaid';
  const diagEmbed = pluginOptions.diagramEmbed ?? 'file';
  const diagTheme = pluginOptions.erdTheme;

  const modelsDir = path.join(outputDir, 'models');
  const allDataModels = context.model.declarations
    .filter(isDataModel)
    .filter((m) => pluginOptions.includeInternalModels || !isIgnoredModel(m));

  const models = allDataModels.filter((m) => !m.isView);
  const views = allDataModels.filter((m) => m.isView);

  const procedures = context.model.declarations.filter(isProcedure);

  const allRelations = collectRelationships(models);
  const hasRelationships =
    options.includeRelationships && allRelations.length > 0;

  if (models.length > 0) {
    fs.mkdirSync(modelsDir, { recursive: true });
    const sortedModels = [...models].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const modelNav = buildNavList(
      sortedModels.map((m) => m.name),
      './',
    );

    for (const model of sortedModels) {
      const mdPath = path.join(modelsDir, `${model.name}.md`);
      const content = renderModelPage({
        allModels: models,
        model,
        navigation: modelNav.get(model.name),
        options,
        procedures,
      });
      await writePageWithDiagrams(
        mdPath,
        content,
        diagFmt,
        diagEmbed,
        diagTheme,
      );
      filesGenerated++;
    }
  }

  const viewsDir = path.join(outputDir, 'views');
  if (views.length > 0) {
    fs.mkdirSync(viewsDir, { recursive: true });
    const sortedViews = [...views].sort((a, b) => a.name.localeCompare(b.name));
    const viewNav = buildNavList(
      sortedViews.map((v) => v.name),
      './',
    );
    for (const view of sortedViews) {
      const mdPath = path.join(viewsDir, `${view.name}.md`);
      const content = renderViewPage({
        navigation: viewNav.get(view.name),
        options,
        view,
      });
      await writePageWithDiagrams(
        mdPath,
        content,
        diagFmt,
        diagEmbed,
        diagTheme,
      );
      filesGenerated++;
    }
  }

  if (hasRelationships) {
    const mdPath = path.join(outputDir, 'relationships.md');
    const content = renderRelationshipsPage({
      genCtx,
      includeGeneratedHeader: options.includeGeneratedHeader,
      relations: allRelations,
    });
    await writePageWithDiagrams(mdPath, content, diagFmt, diagEmbed, diagTheme);
    filesGenerated++;
  }

  const typesDir = path.join(outputDir, 'types');
  const typeDefs = context.model.declarations.filter(isTypeDef);
  if (typeDefs.length > 0) {
    fs.mkdirSync(typesDir, { recursive: true });
    const sortedTypes = [...typeDefs].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const typeNav = buildNavList(
      sortedTypes.map((t) => t.name),
      './',
    );
    for (const typeDef of sortedTypes) {
      const mdPath = path.join(typesDir, `${typeDef.name}.md`);
      const content = renderTypePage({
        allModels: [...models, ...views],
        navigation: typeNav.get(typeDef.name),
        options,
        typeDef,
      });
      await writePageWithDiagrams(
        mdPath,
        content,
        diagFmt,
        diagEmbed,
        diagTheme,
      );
      filesGenerated++;
    }
  }

  const enumsDir = path.join(outputDir, 'enums');
  const enums = context.model.declarations.filter(isEnum);
  if (enums.length > 0) {
    fs.mkdirSync(enumsDir, { recursive: true });
    const sortedEnums = [...enums].sort((a, b) => a.name.localeCompare(b.name));
    const enumNav = buildNavList(
      sortedEnums.map((e) => e.name),
      './',
    );
    for (const enumDecl of sortedEnums) {
      const mdPath = path.join(enumsDir, `${enumDecl.name}.md`);
      const content = renderEnumPage({
        allModels: [...models, ...views],
        enumDecl,
        navigation: enumNav.get(enumDecl.name),
        options,
      });
      await writePageWithDiagrams(
        mdPath,
        content,
        diagFmt,
        diagEmbed,
        diagTheme,
      );
      filesGenerated++;
    }
  }

  const proceduresDir = path.join(outputDir, 'procedures');
  if (procedures.length > 0) {
    fs.mkdirSync(proceduresDir, { recursive: true });
    const sortedProcs = [...procedures].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const procNav = buildNavList(
      sortedProcs.map((p) => p.name),
      './',
    );
    for (const proc of sortedProcs) {
      const mdPath = path.join(proceduresDir, `${proc.name}.md`);
      const content = renderProcedurePage({
        navigation: procNav.get(proc.name),
        options,
        proc,
      });
      await writePageWithDiagrams(
        mdPath,
        content,
        diagFmt,
        diagEmbed,
        diagTheme,
      );
      filesGenerated++;
    }
  }

  if (pluginOptions.generateSkill) {
    const skillMdPath = path.join(outputDir, 'SKILL.md');
    const skillContent = renderSkillPage({
      enums,
      hasRelationships,
      models,
      procedures,
      relations: allRelations,
      title: pluginOptions.title ?? 'Schema Documentation',
      typeDefs,
      views,
    });
    await writePageWithDiagrams(
      skillMdPath,
      skillContent,
      diagFmt,
      diagEmbed,
      diagTheme,
    );
    filesGenerated++;
  }

  let hasErdSvg = false;
  let hasErdMmd = false;
  if (pluginOptions.generateErd) {
    const mermaidSource = buildFullErDiagram({
      models,
      relations: allRelations,
    });
    const format = pluginOptions.erdFormat ?? 'both';

    if (format === 'mmd' || format === 'both') {
      writeFile(path.join(outputDir, 'schema-erd.mmd'), mermaidSource);
      filesGenerated++;
      hasErdMmd = true;
    }

    if (format === 'svg' || format === 'both') {
      const svg = await renderErdSvg(mermaidSource, pluginOptions.erdTheme);
      if (svg) {
        writeFile(path.join(outputDir, 'schema-erd.svg'), svg);
        filesGenerated++;
        hasErdSvg = true;
      } else if (format === 'svg') {
        writeFile(path.join(outputDir, 'schema-erd.mmd'), mermaidSource);
        filesGenerated++;
        hasErdMmd = true;
      }
    }
  }

  filesGenerated++;
  genCtx.durationMs = Math.round((performance.now() - startTime) * 100) / 100;
  genCtx.filesGenerated = filesGenerated;

  writeFile(
    path.join(outputDir, 'index.md'),
    renderIndexPage({
      astModel: context.model,
      genCtx,
      hasErdMmd,
      hasErdSvg,
      hasRelationships,
      pluginOptions,
    }),
  );
}

/**
 * Resolves the absolute output directory path from plugin options or the CLI default.
 */
function resolveOutputDir(options: PluginOptions, defaultPath: string): string {
  return path.resolve(options.output ?? defaultPath);
}

/**
 * Extracts typed plugin options from the raw ZModel plugin block key-value pairs.
 */
function resolvePluginOptions(raw: Record<string, unknown>): PluginOptions {
  return {
    diagramEmbed: (['file', 'inline'] as const).includes(
      raw['diagramEmbed'] as 'file' | 'inline',
    )
      ? (raw['diagramEmbed'] as 'file' | 'inline')
      : 'file',
    diagramFormat: (['mermaid', 'svg', 'both'] as const).includes(
      raw['diagramFormat'] as 'both' | 'mermaid' | 'svg',
    )
      ? (raw['diagramFormat'] as 'both' | 'mermaid' | 'svg')
      : 'mermaid',
    erdFormat: (['svg', 'mmd', 'both'] as const).includes(
      raw['erdFormat'] as 'both' | 'mmd' | 'svg',
    )
      ? (raw['erdFormat'] as 'both' | 'mmd' | 'svg')
      : 'both',
    erdTheme: typeof raw['erdTheme'] === 'string' ? raw['erdTheme'] : undefined,
    fieldOrder:
      raw['fieldOrder'] === 'alphabetical' ? 'alphabetical' : 'declaration',
    generateErd: raw['generateErd'] === true,
    generateSkill: raw['generateSkill'] === true,
    includeGeneratedHeader: raw['includeGeneratedHeader'] !== false,
    includeGenerationStats: raw['includeGenerationStats'] !== false,
    includeIndexes: raw['includeIndexes'] !== false,
    includeInternalModels: raw['includeInternalModels'] === true,
    includePolicies: raw['includePolicies'] !== false,
    includeRelationships: raw['includeRelationships'] !== false,
    includeValidation: raw['includeValidation'] !== false,
    output: typeof raw['output'] === 'string' ? raw['output'] : undefined,
    title: typeof raw['title'] === 'string' ? raw['title'] : undefined,
  };
}

/**
 * Writes content to a file, wrapping fs errors with the target path for diagnostics.
 */
function writeFile(filePath: string, content: string): void {
  try {
    fs.writeFileSync(filePath, content);
  } catch (error) {
    throw new Error(
      `Failed to write "${filePath}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Writes a markdown page, optionally converting inline Mermaid blocks to companion SVG files.
 */
async function writePageWithDiagrams(
  filePath: string,
  content: string,
  diagramFormat: 'both' | 'mermaid' | 'svg',
  embed: 'file' | 'inline',
  theme?: string,
): Promise<number> {
  const baseName = path.basename(filePath, '.md');
  const dir = path.dirname(filePath);
  const result = await processDiagrams(
    content,
    baseName,
    diagramFormat,
    embed,
    theme,
  );
  writeFile(filePath, result.markdown);
  for (const svg of result.svgFiles) {
    writeFile(path.join(dir, svg.filename), svg.content);
  }

  return result.svgFiles.length;
}
