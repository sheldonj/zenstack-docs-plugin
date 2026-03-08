import { generateFromSchema, readDoc as readDocument } from '../utils';
import { beforeAll, describe, expect, it } from 'vitest';

describe('documentation plugin: enum page', () => {
  it('generates enum page with heading, description, values, source, and declaration', async () => {
    const tmpDir = await generateFromSchema(`
            /// User roles in the system.
            enum Role {
                /// Full access
                ADMIN
                /// Standard access
                USER
                GUEST
            }
            model User {
                id   String @id @default(cuid())
                role Role
            }
        `);

    const enumDocument = readDocument(tmpDir, 'enums', 'Role.md');
    expect(enumDocument).toContain('# Role');
    expect(enumDocument).toContain('User roles in the system.');
    expect(enumDocument).toContain('## 🏷️ Values');
    expect(enumDocument).toContain('| `ADMIN`');
    expect(enumDocument).toContain('Full access');
    expect(enumDocument).toContain('| `USER`');
    expect(enumDocument).toContain('Standard access');
    expect(enumDocument).toContain('| `GUEST`');

    expect(enumDocument).toContain('**Defined in:**');
    expect(enumDocument).toContain('.zmodel');
    expect(enumDocument).toContain('<summary>Declaration');
    expect(enumDocument).toContain('```prisma');
    expect(enumDocument).toContain('enum Role {');

    expect(enumDocument).toContain('zenstack.dev');
  });

  describe('enum with usage by models', () => {
    let tmpDir: string;
    beforeAll(async () => {
      tmpDir = await generateFromSchema(`
                model User {
                    id   String @id @default(cuid())
                    role Role
                }
                model Post {
                    id     String @id @default(cuid())
                    status Role
                }
                enum Role {
                    ADMIN
                    USER
                }
            `);
    });

    it('shows Used By section with model links, class diagram, and field deep-links', () => {
      const roleDocument = readDocument(tmpDir, 'enums', 'Role.md');
      expect(roleDocument).toContain('[Index](../index.md)');
      expect(roleDocument).toContain('## 📍 Used By');
      expect(roleDocument).toContain('[Post](../models/Post.md)');
      expect(roleDocument).toContain('[User](../models/User.md)');

      expect(roleDocument).toContain('```mermaid');
      expect(roleDocument).toContain('classDiagram');
      expect(roleDocument).toContain('enumeration');
      expect(roleDocument).toContain('role');
      expect(roleDocument).toContain('status');

      expect(roleDocument).toContain('../models/Post.md#field-status');
      expect(roleDocument).toContain('../models/User.md#field-role');
    });
  });

  it('omits class diagram when no models use it', async () => {
    const tmpDir = await generateFromSchema(`
            enum Status { ACTIVE INACTIVE }
            model User {
                id String @id @default(cuid())
            }
        `);

    expect(readDocument(tmpDir, 'enums', 'Status.md')).not.toContain(
      '```mermaid',
    );
  });

  it('links to views (not models) when a view references the enum', async () => {
    const tmpDir = await generateFromSchema(`
            enum Status { ACTIVE INACTIVE }
            model Post {
                id     String @id @default(cuid())
                status Status
            }
            view PostSummary {
                id     String
                status Status
            }
        `);

    const enumDocument = readDocument(tmpDir, 'enums', 'Status.md');
    expect(enumDocument).toContain('## 📍 Used By');
    expect(enumDocument).toContain('[PostSummary](../views/PostSummary.md)');
    expect(enumDocument).toContain('../views/PostSummary.md#field-status');
    expect(enumDocument).toContain('[Post](../models/Post.md)');
    expect(enumDocument).not.toContain(
      '[PostSummary](../models/PostSummary.md)',
    );
  });

  it('includes prev/next navigation footer', async () => {
    const tmpDir = await generateFromSchema(`
            model User {
                id String @id @default(cuid())
            }
            enum Alpha { A B }
            enum Beta { X Y }
            enum Gamma { P Q }
        `);

    expect(readDocument(tmpDir, 'enums', 'Alpha.md')).toContain(
      'Next: [Beta](./Beta.md)',
    );
    const betaDocument = readDocument(tmpDir, 'enums', 'Beta.md');
    expect(betaDocument).toContain('Previous: [Alpha](./Alpha.md)');
    expect(betaDocument).toContain('Next: [Gamma](./Gamma.md)');
  });
});
