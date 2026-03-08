import { generateFromSchema, readDoc as readDocument } from '../utils';
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('documentation plugin: type page', () => {
  it('generates type page with heading, description, fields, source, declaration, and anchors', async () => {
    const tmpDir = await generateFromSchema(`
            /// Common timestamp fields for all models.
            type Timestamps {
                createdAt DateTime @default(now())
                updatedAt DateTime @updatedAt
            }
            model User {
                id String @id @default(cuid())
            }
        `);

    expect(fs.existsSync(path.join(tmpDir, 'types', 'Timestamps.md'))).toBe(
      true,
    );
    const typeDocument = readDocument(tmpDir, 'types', 'Timestamps.md');
    expect(typeDocument).toContain('# Timestamps');
    expect(typeDocument).toContain('Common timestamp fields');
    expect(typeDocument).toContain('[Index](../index.md)');
    expect(typeDocument).toContain('## 📋 Fields');
    expect(typeDocument).toContain('field-createdAt');
    expect(typeDocument).toContain('field-updatedAt');

    expect(typeDocument).toContain('**Defined in:**');
    expect(typeDocument).toContain('.zmodel');
    expect(typeDocument).toContain('<summary>Declaration');
    expect(typeDocument).toContain('```prisma');
    expect(typeDocument).toContain('type Timestamps {');

    expect(typeDocument).toContain('<a id="field-createdAt"></a>');
    expect(typeDocument).toContain('<a id="field-updatedAt"></a>');
  });

  describe('type with mixin consumers', () => {
    let tmpDir: string;
    beforeAll(async () => {
      tmpDir = await generateFromSchema(`
                type Timestamps {
                    createdAt DateTime @default(now())
                    updatedAt DateTime @updatedAt
                }
                model User with Timestamps {
                    id String @id @default(cuid())
                }
                model Post with Timestamps {
                    id String @id @default(cuid())
                }
                model Tag {
                    id String @id @default(cuid())
                }
            `);
    });
    afterAll(() => {
      if (tmpDir) {
        fs.rmSync(tmpDir, { force: true, recursive: true });
      }
    });

    it('shows Used By section with model links and field deep-links', () => {
      const typeDocument = readDocument(tmpDir, 'types', 'Timestamps.md');
      expect(typeDocument).toContain('## 📍 Used By');
      expect(typeDocument).toContain('[Post](../models/Post.md');
      expect(typeDocument).toContain('[User](../models/User.md');
      expect(typeDocument).not.toContain('[Tag]');
      expect(typeDocument).toContain('../models/Post.md#field-createdAt');
      expect(typeDocument).toContain('../models/User.md#field-createdAt');
    });

    it('includes class diagram showing mixin usage', () => {
      const typeDocument = readDocument(tmpDir, 'types', 'Timestamps.md');
      expect(typeDocument).toContain('```mermaid');
      expect(typeDocument).toContain('classDiagram');
      expect(typeDocument).toContain('mixin');
      expect(typeDocument).toContain('Post');
      expect(typeDocument).toContain('User');
      expect(typeDocument).not.toMatch(/Tag/u);
    });
  });

  it('omits class diagram when no models use it', async () => {
    const tmpDir = await generateFromSchema(`
            type Metadata {
                version Int @default(1)
            }
            model User {
                id String @id @default(cuid())
            }
        `);
    expect(readDocument(tmpDir, 'types', 'Metadata.md')).not.toContain(
      'classDiagram',
    );
  });

  it('fields default to declaration order', async () => {
    const tmpDir = await generateFromSchema(`
            type Metadata {
                version Int @default(1)
                createdBy String
                active Boolean
            }
            model User {
                id String @id @default(cuid())
            }
        `);

    const typeDocument = readDocument(tmpDir, 'types', 'Metadata.md');
    const versionIndex = typeDocument.indexOf('field-version');
    const createdByIndex = typeDocument.indexOf('field-createdBy');
    const activeIndex = typeDocument.indexOf('field-active');
    expect(versionIndex).toBeLessThan(createdByIndex);
    expect(createdByIndex).toBeLessThan(activeIndex);
  });
});

describe('documentation plugin: view page', () => {
  it('renders view with badge, breadcrumb, fields, declaration, docs link, and anchors', async () => {
    const tmpDir = await generateFromSchema(`
            /// Flattened user info for reporting.
            view UserInfo {
                id    Int
                email String
                name  String
            }
            model User {
                id String @id @default(cuid())
            }
        `);

    const viewDocument = readDocument(tmpDir, 'views', 'UserInfo.md');
    expect(viewDocument).toContain('<kbd>View</kbd>');
    expect(viewDocument).not.toContain('<kbd>Model</kbd>');
    expect(viewDocument).toContain('[Views](../index.md#views)');
    expect(viewDocument).toContain('Flattened user info for reporting');

    expect(viewDocument).toContain('## 📋 Fields');
    expect(viewDocument).toContain('field-id');
    expect(viewDocument).toContain('field-email');
    expect(viewDocument).toContain('`Int`');
    expect(viewDocument).toContain('`String`');

    expect(viewDocument).toContain('<summary>Declaration');
    expect(viewDocument).toContain('view UserInfo');
    expect(viewDocument).toContain(
      'https://zenstack.dev/docs/reference/zmodel/view',
    );

    expect(viewDocument).toContain('<a id="field-id"></a>');
    expect(viewDocument).toContain('<a id="field-email"></a>');
  });

  it('Mermaid diagram renders primitive field types correctly', async () => {
    const tmpDir = await generateFromSchema(`
            model User {
                id    String @id @default(cuid())
            }
            view UserSummary {
                id    Int
                name  String
            }
        `);

    const viewDocument = readDocument(tmpDir, 'views', 'UserSummary.md');
    expect(viewDocument).toContain('```mermaid');
    expect(viewDocument).not.toContain('Unknown');
    expect(viewDocument).toContain('Int id');
    expect(viewDocument).toContain('String name');
  });
});
