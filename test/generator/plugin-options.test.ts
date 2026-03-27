import plugin from '../../src';
import { loadSchema } from '../utils';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('documentation plugin: plugin options', () => {
  it('cleanOutput deletes existing files in the output directory before generation', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-plugin-'));
    // create a stale file that should be removed by cleanOutput
    fs.writeFileSync(path.join(tmpDir, 'stale.txt'), 'stale');

    const model = await loadSchema(`
      model A {
        id String @id @default(cuid())
      }
    `);

    await plugin.generate({
      defaultOutputPath: tmpDir,
      model,
      pluginOptions: { cleanOutput: true, output: tmpDir },
      schemaFile: 'schema.zmodel',
    });

    // ensure output dir is prepopulated and removed by cleanOutput

    expect(fs.existsSync(path.join(tmpDir, 'stale.txt'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'index.md'))).toBe(true);
  });
  it("models with @@meta('doc:ignore', true) are treated as internal and excluded when includeInternalModels is false", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-plugin-'));

    const schema = `
        model Public {
          id String @id @default(cuid())
        }
      
        model Internal {
          id String @id @default(cuid())
          @@meta('doc:ignore', true)
        }
      `;

    const model = await loadSchema(schema);

    await plugin.generate({
      defaultOutputPath: tmpDir,
      model,
      pluginOptions: { includeInternalModels: false, output: tmpDir },
      schemaFile: 'schema.zmodel',
    });

    // Public model should be present, internal model should be excluded
    expect(fs.existsSync(path.join(tmpDir, 'models', 'Public.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'models', 'Internal.md'))).toBe(
      false,
    );
  });
});
