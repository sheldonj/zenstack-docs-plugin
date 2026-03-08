import plugin from '../src';
import { invariant } from '@zenstackhq/common-helpers';
import { loadDocument } from '@zenstackhq/language';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect } from 'vitest';

const DATASOURCE_PREAMBLE = `
datasource db {
    provider = 'sqlite'
    url      = 'file:./dev.db'
}
`;

const policyPluginZmodel = path.resolve(
  __dirname,
  './fixtures/policy-plugin.zmodel',
);
const pluginDocs = fs.existsSync(policyPluginZmodel)
  ? [policyPluginZmodel]
  : [];

/**
 * Extracts all relative markdown links from content and verifies
 * each target file exists relative to the source file's directory.
 * Returns an array of broken links with details.
 */
export function findBrokenLinks(
  outputDir: string,
): Array<{ link: string; source: string; target: string }> {
  const broken: Array<{ link: string; source: string; target: string }> = [];
  const mdFiles = collectMdFiles(outputDir);

  for (const mdFile of mdFiles) {
    const content = fs.readFileSync(mdFile, 'utf8');
    const linkPattern = /\[[^\]]*\]\(([^)]+)\)/gu;
    let match: null | RegExpExecArray;
    while ((match = linkPattern.exec(content)) !== null) {
      const href = match[1];
      if (!href || href.startsWith('http') || href.startsWith('#')) {
        continue;
      }

      const filePart = href.split('#')[0];
      if (!filePart) {
        continue;
      }

      const resolved = path.resolve(path.dirname(mdFile), filePart);
      if (!fs.existsSync(resolved)) {
        broken.push({
          link: href,
          source: path.relative(outputDir, mdFile),
          target: path.relative(outputDir, resolved),
        });
      }
    }
  }

  return broken;
}

export function findFieldLine(
  document: string,
  fieldName: string,
): string | undefined {
  return document.split('\n').find((l) => l.includes(`field-${fieldName}`));
}

export async function generateFromFile(
  schemaFile: string,
  pluginOptions: Record<string, unknown> = {},
): Promise<string> {
  const model = await loadSchemaFromFile(schemaFile);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-plugin-'));
  await plugin.generate({
    defaultOutputPath: tmpDir,
    model,
    pluginOptions: { output: tmpDir, ...pluginOptions },
    schemaFile,
  });
  return tmpDir;
}

export async function generateFromSchema(
  schema: string,
  pluginOptions: Record<string, unknown> = {},
  schemaFile = 'schema.zmodel',
): Promise<string> {
  const model = await loadSchema(schema);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-plugin-'));
  await plugin.generate({
    defaultOutputPath: tmpDir,
    model,
    pluginOptions: { output: tmpDir, ...pluginOptions },
    schemaFile,
  });
  return tmpDir;
}

export async function loadSchema(schema: string) {
  const fullSchema = DATASOURCE_PREAMBLE + schema;
  const temporaryFile = path.join(
    os.tmpdir(),
    `zenstack-schema-${crypto.randomUUID()}.zmodel`,
  );
  fs.writeFileSync(temporaryFile, fullSchema);
  const result = await loadDocument(temporaryFile, pluginDocs);
  expect(result).toSatisfy(
    (value: typeof result) => value.success,
    `Failed to load schema: ${result.success ? '' : result.errors.map((e) => e.toString()).join(', ')}`,
  );
  invariant(result.success);
  return result.model;
}

export async function loadSchemaFromFile(filePath: string) {
  const result = await loadDocument(filePath, pluginDocs);
  expect(result).toSatisfy(
    (value: typeof result) => value.success,
    `Failed to load schema from ${filePath}: ${result.success ? '' : result.errors.map((e) => e.toString()).join(', ')}`,
  );
  invariant(result.success);
  return result.model;
}

export function readDoc(tmpDir: string, ...segments: string[]): string {
  return fs.readFileSync(path.join(tmpDir, ...segments), 'utf8');
}

function collectMdFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMdFiles(full));
    } else if (entry.name.endsWith('.md')) {
      results.push(full);
    }
  }

  return results;
}
