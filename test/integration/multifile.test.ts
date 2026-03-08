import {
  findBrokenLinks,
  generateFromFile,
  readDoc as readDocument,
} from '../utils';
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const MULTIFILE_SCHEMA = path.resolve(
  __dirname,
  '../../zenstack/multifile/schema.zmodel',
);

describe('integration: multi-file schema', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await generateFromFile(MULTIFILE_SCHEMA);
  });

  afterAll(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { force: true, recursive: true });
    }
  });

  it('artifacts show correct source file paths for declarations across files', () => {
    const userDocument = readDocument(tmpDir, 'models', 'User.md');
    expect(userDocument).toContain('**Defined in:**');
    expect(userDocument).toContain('models.zmodel');

    const roleDocument = readDocument(tmpDir, 'enums', 'Role.md');
    expect(roleDocument).toContain('**Defined in:**');
    expect(roleDocument).toContain('enums.zmodel');

    const tsDocument = readDocument(tmpDir, 'types', 'Timestamps.md');
    expect(tsDocument).toContain('**Defined in:**');
    expect(tsDocument).toContain('mixins.zmodel');
  });

  it('has zero broken links across multi-file output', () => {
    expect(findBrokenLinks(tmpDir)).toEqual([]);
  });

  it('declaration code blocks show correct source for each file', () => {
    const userDocument = readDocument(tmpDir, 'models', 'User.md');
    expect(userDocument).toContain('<summary>Declaration');
    expect(userDocument).toContain('model User');

    const roleDocument = readDocument(tmpDir, 'enums', 'Role.md');
    expect(roleDocument).toContain('<summary>Declaration');
    expect(roleDocument).toContain('enum Role');

    const tsDocument = readDocument(tmpDir, 'types', 'Timestamps.md');
    expect(tsDocument).toContain('<summary>Declaration');
    expect(tsDocument).toContain('type Timestamps');
  });
});
