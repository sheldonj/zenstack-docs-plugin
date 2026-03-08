import { generateFromSchema, readDoc as readDocument } from '../utils';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('documentation plugin: per-page SVG diagrams', () => {
  it('model page references companion SVG file when diagramFormat is svg', async () => {
    const tmpDir = await generateFromSchema(
      `
            model User {
                id    String @id @default(cuid())
                name  String
                posts Post[]
            }
            model Post {
                id       String @id @default(cuid())
                title    String
                author   User   @relation(fields: [authorId], references: [id])
                authorId String
            }
            `,
      { diagramFormat: 'svg' },
    );

    const userDocument = readDocument(tmpDir, 'models', 'User.md');
    expect(userDocument).not.toContain('```mermaid');
    expect(userDocument).toContain('![diagram](./User-diagram.svg)');

    const svgPath = path.join(tmpDir, 'models', 'User-diagram.svg');
    expect(fs.existsSync(svgPath)).toBe(true);
    expect(fs.readFileSync(svgPath, 'utf8')).toContain('<svg');
  });

  it('model page has SVG image and collapsible mermaid when diagramFormat is both', async () => {
    const tmpDir = await generateFromSchema(
      `
            model User {
                id    String @id @default(cuid())
                name  String
                posts Post[]
            }
            model Post {
                id       String @id @default(cuid())
                title    String
                author   User   @relation(fields: [authorId], references: [id])
                authorId String
            }
            `,
      { diagramFormat: 'both' },
    );

    const userDocument = readDocument(tmpDir, 'models', 'User.md');
    expect(userDocument).toContain('![diagram](./User-diagram.svg)');
    expect(userDocument).toContain('```mermaid');
    expect(userDocument).toContain('<details>');
    expect(userDocument).toContain('Mermaid source');

    expect(fs.existsSync(path.join(tmpDir, 'models', 'User-diagram.svg'))).toBe(
      true,
    );
  });

  it('default behavior preserves inline mermaid with no SVG files', async () => {
    const tmpDir = await generateFromSchema(
      `
            model User {
                id    String @id @default(cuid())
                name  String
                posts Post[]
            }
            model Post {
                id       String @id @default(cuid())
                title    String
                author   User   @relation(fields: [authorId], references: [id])
                authorId String
            }
            `,
    );

    const userDocument = readDocument(tmpDir, 'models', 'User.md');
    expect(userDocument).toContain('```mermaid');
    expect(userDocument).not.toContain('![diagram]');
    expect(fs.existsSync(path.join(tmpDir, 'models', 'User-diagram.svg'))).toBe(
      false,
    );
  });

  it('enum page gets companion SVG when diagramFormat is svg', async () => {
    const tmpDir = await generateFromSchema(
      `
            model User {
                id   String @id @default(cuid())
                role Role
            }
            enum Role { ADMIN USER }
            `,
      { diagramFormat: 'svg' },
    );

    const enumDocument = readDocument(tmpDir, 'enums', 'Role.md');
    expect(enumDocument).not.toContain('```mermaid');
    expect(enumDocument).toContain('![diagram](./Role-diagram.svg)');
    expect(fs.existsSync(path.join(tmpDir, 'enums', 'Role-diagram.svg'))).toBe(
      true,
    );
  });

  it('procedure page gets companion SVG when diagramFormat is svg', async () => {
    const tmpDir = await generateFromSchema(
      `
            model User {
                id   String @id @default(cuid())
                name String
            }
            procedure getUser(id: String): User
            `,
      { diagramFormat: 'svg' },
    );

    const procDocument = readDocument(tmpDir, 'procedures', 'getUser.md');
    expect(procDocument).not.toContain('```mermaid');
    expect(procDocument).toContain('![diagram](./getUser-diagram.svg)');
    expect(
      fs.existsSync(path.join(tmpDir, 'procedures', 'getUser-diagram.svg')),
    ).toBe(true);
  });

  it('relationships page gets companion SVG when diagramFormat is svg', async () => {
    const tmpDir = await generateFromSchema(
      `
            model User {
                id    String @id @default(cuid())
                posts Post[]
            }
            model Post {
                id       String @id @default(cuid())
                author   User   @relation(fields: [authorId], references: [id])
                authorId String
            }
            `,
      { diagramFormat: 'svg' },
    );

    const relDocument = readDocument(tmpDir, 'relationships.md');
    expect(relDocument).not.toContain('```mermaid');
    expect(relDocument).toContain('![diagram](./relationships-diagram.svg)');
    expect(fs.existsSync(path.join(tmpDir, 'relationships-diagram.svg'))).toBe(
      true,
    );
  });

  it('erdTheme applies to companion SVG files', async () => {
    const tmpDir = await generateFromSchema(
      `
            model User {
                id    String @id @default(cuid())
                posts Post[]
            }
            model Post {
                id       String @id @default(cuid())
                author   User   @relation(fields: [authorId], references: [id])
                authorId String
            }
            `,
      { diagramFormat: 'svg', erdTheme: 'dracula' },
    );

    const svgPath = path.join(tmpDir, 'models', 'User-diagram.svg');
    expect(fs.existsSync(svgPath)).toBe(true);
    expect(fs.readFileSync(svgPath, 'utf8')).toContain('<svg');
  });

  it('view page gets companion SVG when diagramFormat is svg', async () => {
    const tmpDir = await generateFromSchema(
      `
            model User {
                id   String @id @default(cuid())
                name String
            }
            view UserProfile {
                name String
            }
            `,
      { diagramFormat: 'svg' },
    );

    const viewDocument = readDocument(tmpDir, 'views', 'UserProfile.md');
    expect(viewDocument).not.toContain('```mermaid');
    expect(viewDocument).toContain('![diagram](./UserProfile-diagram.svg)');
    expect(
      fs.existsSync(path.join(tmpDir, 'views', 'UserProfile-diagram.svg')),
    ).toBe(true);
  });
});
