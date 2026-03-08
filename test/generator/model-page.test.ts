import plugin from '../../src';
import {
  findFieldLine,
  generateFromSchema,
  loadSchemaFromFile,
  readDoc as readDocument,
} from '../utils';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

describe('documentation plugin: model page', () => {
  describe('basic model with id only', () => {
    let userDocument: string;
    beforeAll(async () => {
      const tmpDir = await generateFromSchema(`
                model User {
                    id String @id @default(cuid())
                }
            `);
      userDocument = readDocument(tmpDir, 'models', 'User.md');
    });

    it('renders heading with emoji, source path, declaration summary, and external docs link', () => {
      const headingLine = userDocument
        .split('\n')
        .find((l) => l.startsWith('# '));
      expect(headingLine).toContain('🗃️');

      expect(userDocument).toContain('**Defined in:**');
      expect(userDocument).toContain('.zmodel');

      const summaryLine = userDocument
        .split('\n')
        .find((l) => l.includes('<summary>'));
      expect(summaryLine).toContain('Declaration');
      expect(summaryLine).toContain('.zmodel');

      expect(userDocument).toContain('zenstack.dev');
      expect(userDocument).toContain('/zmodel/model');
    });

    it('handles model with only an id field gracefully', () => {
      expect(userDocument).toContain('# 🗃️');
      expect(userDocument).toContain('Fields');
    });
  });

  it('renders heading, description, and declaration with comment stripping', async () => {
    const tmpDir = await generateFromSchema(`
            /// Represents a registered user.
            /// Has many posts.
            model User {
                id    String @id @default(cuid())
                /// The user's email address.
                email String
            }
        `);

    const userDocument = readDocument(tmpDir, 'models', 'User.md');
    expect(userDocument).toContain('# 🗃️ User');
    expect(userDocument).toContain('Represents a registered user.');
    expect(userDocument).toContain('Has many posts.');

    expect(userDocument).toContain('<details>');
    expect(userDocument).toContain('<summary>Declaration');
    expect(userDocument).toContain('```prisma');
    expect(userDocument).toContain('model User {');
    expect(userDocument).toContain('</details>');

    const declarationStart = userDocument.indexOf('```prisma');
    const declarationEnd = userDocument.indexOf('```', declarationStart + 10);
    const declaration = userDocument.slice(declarationStart, declarationEnd);
    expect(declaration).not.toContain('///');
    expect(declaration).toContain('email String');
  });

  it('renders metadata with horizontal rule before declaration', async () => {
    const tmpDir = await generateFromSchema(`
            /// A registered user.
            model User {
                id String @id @default(cuid())
                @@meta('doc:category', 'Identity')
                @@meta('doc:since', '2.0')
                @@meta('doc:deprecated', 'Use Account instead')
            }
        `);

    const userDocument = readDocument(tmpDir, 'models', 'User.md');
    expect(userDocument).toContain('**Category:** Identity');
    expect(userDocument).toContain('**Since:** 2.0');
    expect(userDocument).toContain('**Deprecated:** Use Account instead');
    expect(userDocument).toContain('**Defined in:**');
    expect(userDocument).not.toContain('| | |');

    const categoryIndex = userDocument.indexOf('**Category:**');
    const detailsIndex = userDocument.indexOf('<details>');
    const hrIndex = userDocument.indexOf('---', categoryIndex);
    expect(hrIndex).toBeGreaterThan(categoryIndex);
    expect(hrIndex).toBeLessThan(detailsIndex);
  });

  describe('model with full features', () => {
    let userDocument: string;
    beforeAll(async () => {
      const tmpDir = await generateFromSchema(`
                type Timestamps {
                    createdAt DateTime @default(now())
                }
                model User with Timestamps {
                    id    String @id @default(cuid())
                    email String @unique @email
                    posts Post[]
                    @@allow('read', true)
                    @@index([email])
                }
                model Post {
                    id       String @id @default(cuid())
                    author   User   @relation(fields: [authorId], references: [id])
                    authorId String
                }
            `);
      userDocument = readDocument(tmpDir, 'models', 'User.md');
    });

    it('includes table of contents with On this page label', () => {
      expect(userDocument).toContain('[Fields](#fields)');
      expect(userDocument).toContain('[Relationships](#relationships)');
      expect(userDocument).toContain('[Access Policies](#access-policies)');
      expect(userDocument).toContain('[Indexes](#indexes)');
      expect(userDocument).toContain('[Validation Rules](#validation-rules)');

      const tocLine = userDocument
        .split('\n')
        .find(
          (l: string) => l.includes('[Fields](#fields)') && l.includes(' · '),
        );
      expect(tocLine).toBeDefined();
      expect(tocLine).toMatch(/^>\s*\*\*On this page:\*\*/u);
      expect(userDocument).not.toContain('- [Fields](#fields)');
    });

    it('section headings include contextual descriptions', () => {
      const lines = userDocument.split('\n');
      expect(lines[lines.indexOf('## 🧩 Mixins') + 2]).toMatch(
        /> .*reusable field groups/iu,
      );
      expect(lines[lines.indexOf('## 📋 Fields') + 2]).toMatch(
        /> .*fields defined/iu,
      );
      expect(lines[lines.indexOf('## 🔗 Relationships') + 2]).toMatch(
        /> .*relationships to other/iu,
      );
      expect(lines[lines.indexOf('## 🔐 Access Policies') + 2]).toMatch(
        /> .*access control rules/iu,
      );
      expect(lines[lines.indexOf('## 📇 Indexes') + 2]).toMatch(
        /> .*database indexes/iu,
      );
    });
  });

  it('renders scalar field types as backtick-wrapped', async () => {
    const tmpDir = await generateFromSchema(`
            model User {
                id    String   @id @default(cuid())
                name  String
                age   Int?
                score Float
                active Boolean @default(true)
                joined DateTime @default(now())
            }
        `);

    const document = readDocument(tmpDir, 'models', 'User.md');
    expect(document).toContain('| `String` |');
    expect(document).toContain('| `Int?` |');
    expect(document).toContain('| `Float` |');
    expect(document).toContain('| `Boolean` |');
    expect(document).toContain('| `DateTime` |');
  });

  it('renders fields in declaration order with em-dashes, anchors, and required flags', async () => {
    const tmpDir = await generateFromSchema(`
            model User {
                id    String  @id @default(cuid())
                /// Display name shown in the UI.
                name  String
                email String?
            }
        `);

    const userDocument = readDocument(tmpDir, 'models', 'User.md');
    expect(userDocument).toContain('Fields');
    expect(userDocument).toContain('Display name shown in the UI.');
    expect(userDocument).toContain('`cuid()`');

    const idIndex = userDocument.indexOf('field-id');
    const nameIndex = userDocument.indexOf('field-name');
    const emailIndex = userDocument.indexOf('field-email');
    expect(idIndex).toBeLessThan(nameIndex);
    expect(nameIndex).toBeLessThan(emailIndex);

    expect(findFieldLine(userDocument, 'email')).toContain('No');
    expect(findFieldLine(userDocument, 'id')).toContain('Yes');

    const idLine = findFieldLine(userDocument, 'id');
    expect(idLine).toMatch(/\| — \|$/u);

    expect(userDocument).toContain('<a id="field-id"></a>');
    expect(userDocument).toContain('<a id="field-email"></a>');
    expect(userDocument).toContain('<a id="field-name"></a>');
  });

  it('sorts fields alphabetically when fieldOrder=alphabetical', async () => {
    const tmpDir = await generateFromSchema(
      `
            model User {
                id    String  @id @default(cuid())
                name  String
                email String?
            }
        `,
      { fieldOrder: 'alphabetical' },
    );

    const userDocument = readDocument(tmpDir, 'models', 'User.md');
    const emailIndex = userDocument.indexOf('field-email');
    const idIndex = userDocument.indexOf('field-id');
    const nameIndex = userDocument.indexOf('field-name');
    expect(emailIndex).toBeLessThan(idIndex);
    expect(idIndex).toBeLessThan(nameIndex);
  });

  it('shows Mixins section and links mixin fields in Source column', async () => {
    const tmpDir = await generateFromSchema(`
            type Timestamps {
                /// Record creation time.
                createdAt DateTime @default(now())
                updatedAt DateTime @updatedAt
            }
            type Metadata {
                version Int @default(1)
            }
            model User with Timestamps, Metadata {
                id    String @id @default(cuid())
                /// User email address.
                email String
            }
        `);

    const userDocument = readDocument(tmpDir, 'models', 'User.md');
    expect(userDocument).toContain('Mixins');
    expect(userDocument).toContain('[Timestamps](../types/Timestamps.md)');
    expect(userDocument).toContain('[Metadata](../types/Metadata.md)');
    expect(userDocument).toContain('| Source |');

    const createdAtLine = findFieldLine(userDocument, 'createdAt');
    expect(createdAtLine).toContain('[Timestamps](../types/Timestamps.md)');
    expect(createdAtLine).toContain('Record creation time.');

    const emailLine = findFieldLine(userDocument, 'email');
    expect(emailLine).toContain('User email address.');
    expect(emailLine).not.toContain('[Timestamps]');
  });

  it('renders field attributes (@map, @updatedAt, @json) in Attributes column', async () => {
    const tmpDir = await generateFromSchema(`
            type Address {
                street String
                city   String
            }
            model User {
                id        String   @id @default(cuid())
                name      String   @map("user_name")
                updatedAt DateTime @updatedAt
                address   Address  @json
            }
        `);

    const document = readDocument(tmpDir, 'models', 'User.md');
    expect(findFieldLine(document, 'name')).toContain('@map');
    expect(findFieldLine(document, 'updatedAt')).toContain('`@updatedAt`');
    expect(findFieldLine(document, 'address')).toContain('`@json`');
  });

  it('shows @ignore badge in Type column', async () => {
    const tmpDir = await generateFromSchema(`
            model User {
                id       String @id @default(cuid())
                internal String @ignore
            }
        `);

    const userDocument = readDocument(tmpDir, 'models', 'User.md');
    expect(findFieldLine(userDocument, 'internal')).toContain(
      '<kbd>ignored</kbd>',
    );
  });

  it('marks computed fields with badge and description', async () => {
    const tmpDir = await generateFromSchema(`
            model Project {
                id             String  @id @default(cuid())
                name           String
                /// Total number of tasks in this project.
                taskCount      Int     @computed
                /// Percentage of tasks that are completed.
                completionRate Float   @computed
                /// Whether the project has any overdue tasks.
                isOverdue      Boolean @computed
            }
        `);

    const document = readDocument(tmpDir, 'models', 'Project.md');
    const lines = document.split('\n');

    expect(lines.find((l) => l.includes('field-taskCount'))).toContain(
      '`Int` <kbd>computed</kbd>',
    );
    expect(lines.find((l) => l.includes('field-taskCount'))).toContain(
      'Total number of tasks',
    );
    expect(lines.find((l) => l.includes('field-completionRate'))).toContain(
      '`Float` <kbd>computed</kbd>',
    );
    expect(lines.find((l) => l.includes('field-isOverdue'))).toContain(
      '`Boolean` <kbd>computed</kbd>',
    );
    expect(lines.find((l) => l.includes('field-name'))).not.toContain(
      '<kbd>computed</kbd>',
    );
  });

  it('renders @meta doc:example in fields table', async () => {
    const tmpDir = await generateFromSchema(`
            model User {
                id    String @id @default(cuid())
                email String @meta('doc:example', 'jane@example.com')
            }
        `);

    const userDocument = readDocument(tmpDir, 'models', 'User.md');
    expect(findFieldLine(userDocument, 'email')).toContain('jane@example.com');
  });

  it('renders all predefined default-value functions in Default column', async () => {
    const tmpDir = await generateFromSchema(`
            model Defaults {
                autoId   Int      @id @default(autoincrement())
                uid      String   @default(uuid())
                cid      String   @default(cuid())
                nid      String   @default(nanoid())
                uli      String   @default(ulid())
                created  DateTime @default(now())
                dbVal    String   @default(dbgenerated())
            }
        `);

    const document = readDocument(tmpDir, 'models', 'Defaults.md');
    expect(findFieldLine(document, 'autoId')).toContain('`autoincrement()`');
    expect(findFieldLine(document, 'uid')).toContain('`uuid()`');
    expect(findFieldLine(document, 'cid')).toContain('`cuid()`');
    expect(findFieldLine(document, 'nid')).toContain('`nanoid()`');
    expect(findFieldLine(document, 'uli')).toContain('`ulid()`');
    expect(findFieldLine(document, 'created')).toContain('`now()`');
    expect(findFieldLine(document, 'dbVal')).toContain('`dbgenerated()`');
  });

  it('annotates inherited fields with source model', async () => {
    const tmpDir = await generateFromSchema(`
            model BaseModel {
                id   String @id @default(cuid())
                type String
                @@delegate(type)
            }
            model User extends BaseModel {
                email String
            }
        `);

    const userDocument = readDocument(tmpDir, 'models', 'User.md');
    expect(findFieldLine(userDocument, 'id')).toContain(
      '[BaseModel](./BaseModel.md)',
    );
    expect(findFieldLine(userDocument, 'email')).not.toContain('[BaseModel]');
  });

  describe('relationships', () => {
    let tmpDir: string;
    let userDocument: string;
    let postDocument: string;
    beforeAll(async () => {
      tmpDir = await generateFromSchema(`
                model User {
                    id    String @id @default(cuid())
                    email String @unique
                    posts Post[]
                }
                model Post {
                    id       String @id @default(cuid())
                    title    String
                    author   User   @relation(fields: [authorId], references: [id])
                    authorId String
                }
            `);
      userDocument = readDocument(tmpDir, 'models', 'User.md');
      postDocument = readDocument(tmpDir, 'models', 'Post.md');
    });

    it('renders relationships table and ER diagram with related entity fields', () => {
      expect(userDocument).not.toContain('## 📊 Entity Diagram');

      expect(userDocument).toContain('Relationships');
      expect(userDocument).toContain('| `posts`');
      expect(userDocument).toContain('One→Many');
      expect(userDocument).toContain('```mermaid');
      expect(userDocument).toContain('erDiagram');

      const relSection = userDocument.indexOf('## 🔗 Relationships');
      const diagramStart = userDocument.indexOf('erDiagram', relSection);
      const diagramEnd = userDocument.indexOf('```', diagramStart);
      const diagram = userDocument.slice(diagramStart, diagramEnd);
      expect(diagram).toContain('User {');
      expect(diagram).toContain('Post {');
      expect(diagram).toContain('String id');
      expect(diagram).toContain('String title');
    });

    it('renders Post page with relationship and @relation attribute', () => {
      expect(postDocument).toContain('Relationships');
      expect(postDocument).toContain('| `author`');
      expect(postDocument).toContain('Many→One');

      const authorLine = postDocument
        .split('\n')
        .find((l) => l.includes('field-author') && l.includes('@relation'));
      expect(authorLine).toBeDefined();
      expect(authorLine).toContain('fields: [authorId]');
      expect(authorLine).not.toContain('fields: fields:');
    });
  });

  it('ER diagram caps related entity fields at 10', async () => {
    const tmpDir = await generateFromSchema(`
            model User {
                id    String @id @default(cuid())
                posts Post[]
            }
            model Post {
                id       String @id @default(cuid())
                f1       String
                f2       String
                f3       String
                f4       String
                f5       String
                f6       String
                f7       String
                f8       String
                f9       String
                f10      String
                f11      String
                author   User   @relation(fields: [authorId], references: [id])
                authorId String
            }
        `);

    const userDocument = readDocument(tmpDir, 'models', 'User.md');
    const diagramStart = userDocument.indexOf('erDiagram');
    const diagramEnd = userDocument.indexOf('```', diagramStart);
    const diagram = userDocument.slice(diagramStart, diagramEnd);

    expect(diagram).toContain('Post {');
    expect(diagram).toContain('String f9');
    expect(diagram).not.toContain('String f11');
    expect(diagram).toContain('%% … and 3 more fields');
  });

  it('ER diagram does not include transitive (depth 2+) relationships', async () => {
    const tmpDir = await generateFromSchema(`
            model User {
                id      String @id @default(cuid())
                posts   Post[]
                profile Profile?
            }
            model Post {
                id       String @id @default(cuid())
                author   User   @relation(fields: [authorId], references: [id])
                authorId String
            }
            model Profile {
                id     String @id @default(cuid())
                bio    String?
                user   User   @relation(fields: [userId], references: [id])
                userId String @unique
            }
        `);

    const postDocument = readDocument(tmpDir, 'models', 'Post.md');
    const diagramStart = postDocument.indexOf('erDiagram');
    const diagramEnd = postDocument.indexOf('```', diagramStart);
    const diagram = postDocument.slice(diagramStart, diagramEnd);
    expect(diagram).toContain('User');
    expect(diagram).not.toContain('Profile');
  });

  it('renders access policies with allow/deny rules, evaluation note, and [!IMPORTANT] alert', async () => {
    const tmpDir = await generateFromSchema(`
            model User {
                id    String @id @default(cuid())
                email String
                @@allow('read', true)
                @@deny('delete', true)
            }
        `);

    const userDocument = readDocument(tmpDir, 'models', 'User.md');
    expect(userDocument).toContain('Access Policies');
    expect(userDocument).toContain('| read');
    expect(userDocument).toContain('Allow');
    expect(userDocument).toContain('| delete');
    expect(userDocument).toContain('Deny');
    expect(userDocument).toContain('denied by default');
    expect(userDocument).toContain('@@deny');
    expect(userDocument).toContain('@@allow');
    expect(userDocument).toContain('> [!IMPORTANT]');
  });

  it('auth() function renders in access policy rules', async () => {
    const tmpDir = await generateFromSchema(`
            model User {
                id    String @id @default(cuid())
                email String
                @@auth
                @@allow('read', true)
                @@allow('update', auth() == this)
                @@deny('delete', auth() == this)
            }
        `);

    const document = readDocument(tmpDir, 'models', 'User.md');
    expect(document).toContain('`auth() == this`');
  });

  it('renders validation rules from field-level and model-level attributes', async () => {
    const tmpDir = await generateFromSchema(`
            model User {
                id    String @id @default(cuid())
                email String @email
                name  String @length(1, 100)
            }
        `);

    const userDocument = readDocument(tmpDir, 'models', 'User.md');
    expect(userDocument).toContain('Validation Rules');
    expect(userDocument).toContain('| `email`');
    expect(userDocument).toContain('`@email`');
    expect(userDocument).toContain('| `name`');
    expect(userDocument).toContain('`@length`');
  });

  it('renders all predefined validation attributes', async () => {
    const tmpDir = await generateFromSchema(`
            model Product {
                id          String  @id @default(cuid())
                sku         String  @regex('^[A-Z0-9]+$')
                slug        String  @startsWith('product-')
                suffix      String  @endsWith('-v2')
                tags        String  @contains('sale')
                email       String  @email
                website     String  @url
                name        String  @length(1, 100) @trim @lower
                title       String  @upper
                dateStr     String  @datetime
                price       Float   @gt(0)
                discount    Float   @gte(0)
                maxQty      Int     @lt(1000)
                minQty      Int     @lte(500)
            }
        `);

    const document = readDocument(tmpDir, 'models', 'Product.md');
    const validationSection = document.split('✅ Validation Rules')[1]!;
    for (const attribute of [
      '@regex',
      '@startsWith',
      '@endsWith',
      '@contains',
      '@email',
      '@url',
      '@length',
      '@trim',
      '@lower',
      '@upper',
      '@datetime',
      '@gt',
      '@gte',
      '@lt',
      '@lte',
    ]) {
      expect(validationSection).toContain(`\`${attribute}\``);
    }
  });

  it('@@validate model-level rules render with expression text', async () => {
    const tmpDir = await generateFromSchema(`
            model Event {
                id        String   @id @default(cuid())
                startDate DateTime
                endDate   DateTime
                @@validate(startDate < endDate, "Start must precede end")
            }
        `);

    const document = readDocument(tmpDir, 'models', 'Event.md');
    expect(document).toContain('Validation Rules');
    expect(document).toContain('startDate < endDate');
    expect(document).toContain('Start must precede end');
  });

  it('generates indexes section from @@index and @@unique', async () => {
    const tmpDir = await generateFromSchema(`
            model User {
                id    String @id @default(cuid())
                email String @unique
                name  String
                @@index([name])
                @@unique([email, name])
            }
        `);

    const userDocument = readDocument(tmpDir, 'models', 'User.md');
    expect(userDocument).toContain('Indexes');
    expect(userDocument).toContain('Index');
    expect(userDocument).toContain('Unique');
  });

  it('model with @@map shows mapped table name in metadata', async () => {
    const tmpDir = await generateFromSchema(`
            model User {
                id String @id @default(cuid())
                @@map("users")
            }
        `);
    expect(readDocument(tmpDir, 'models', 'User.md')).toContain(
      '**Table:** `users`',
    );
  });

  it('model with @@schema shows database schema in metadata', async () => {
    const schemaContent = `
            datasource db {
                provider = "postgresql"
                url      = "postgresql://localhost:5432/test"
                schemas  = ["auth", "public"]
            }
            model User {
                id String @id @default(cuid())
                @@schema("auth")
            }
        `;
    const temporarySchemaFile = path.join(
      os.tmpdir(),
      `zenstack-schema-${crypto.randomUUID()}.zmodel`,
    );
    fs.writeFileSync(temporarySchemaFile, schemaContent);
    const model = await loadSchemaFromFile(temporarySchemaFile);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-plugin-'));
    await plugin.generate({
      defaultOutputPath: tmpDir,
      model,
      pluginOptions: { output: tmpDir },
      schemaFile: temporarySchemaFile,
    });
    expect(readDocument(tmpDir, 'models', 'User.md')).toContain(
      '**Schema:** `auth`',
    );
  });

  it('renders @@auth and @@delegate badges on heading', async () => {
    const tmpDir = await generateFromSchema(`
            model User {
                id String @id @default(cuid())
                email String
                @@auth
            }
            enum AssetType { IMAGE VIDEO }
            model Asset {
                id   String    @id @default(cuid())
                type AssetType
                @@delegate(type)
            }
            model Image extends Asset {
                url String
            }
        `);

    const userDocument = readDocument(tmpDir, 'models', 'User.md');
    expect(userDocument).toContain('<kbd>Auth</kbd>');
    expect(userDocument).toContain('<kbd>Model</kbd>');

    const assetDocument = readDocument(tmpDir, 'models', 'Asset.md');
    expect(assetDocument).toContain('<kbd>Delegate</kbd>');
    expect(assetDocument).toContain('<kbd>Model</kbd>');
  });

  it('shows Used in Procedures section and detects param type references', async () => {
    const tmpDir = await generateFromSchema(`
            model User {
                id String @id @default(cuid())
            }
            model Post {
                id String @id @default(cuid())
            }
            procedure getUser(id: String): User
            mutation procedure signUp(name: String): User
            procedure listUsers(): User[]
            procedure findByUser(user: User): Post[]
        `);

    const userDocument = readDocument(tmpDir, 'models', 'User.md');
    expect(userDocument).toContain('Used in Procedures');
    expect(userDocument).toContain('[getUser](../procedures/getUser.md)');
    expect(userDocument).toContain('[signUp](../procedures/signUp.md)');
    expect(userDocument).toContain('[listUsers](../procedures/listUsers.md)');
    expect(userDocument).toContain('[findByUser](../procedures/findByUser.md)');

    const postDocument = readDocument(tmpDir, 'models', 'Post.md');
    expect(postDocument).toContain('[findByUser](../procedures/findByUser.md)');
  });

  it('includes prev/next navigation footer', async () => {
    const tmpDir = await generateFromSchema(`
            model Activity {
                id String @id @default(cuid())
            }
            model Post {
                id String @id @default(cuid())
            }
            model User {
                id String @id @default(cuid())
            }
        `);

    const activityDocument = readDocument(tmpDir, 'models', 'Activity.md');
    expect(activityDocument).toContain('Next: [Post](./Post.md)');
    expect(activityDocument).not.toContain('Previous:');

    const postDocument = readDocument(tmpDir, 'models', 'Post.md');
    expect(postDocument).toContain('Previous: [Activity](./Activity.md)');
    expect(postDocument).toContain('Next: [User](./User.md)');
  });

  it('handles self-referential relations', async () => {
    const tmpDir = await generateFromSchema(`
            model Employee {
                id        String    @id @default(cuid())
                managerId String?
                manager   Employee? @relation("ManagerReports", fields: [managerId], references: [id])
                reports   Employee[] @relation("ManagerReports")
            }
        `);

    const document = readDocument(tmpDir, 'models', 'Employee.md');
    expect(document).toContain('Relationships');
    expect(document).toContain('[Employee](./Employee.md)');
    expect(readDocument(tmpDir, 'relationships.md')).toContain('Employee');
  });

  describe('relationships.md', () => {
    let tmpDir: string;
    beforeAll(async () => {
      tmpDir = await generateFromSchema(`
                model User {
                    id         String @id @default(cuid())
                    posts      Post[] @relation("author")
                    pinnedPost Post?  @relation("pinned")
                    profile    Profile?
                }
                model Post {
                    id          String @id @default(cuid())
                    author      User   @relation("author", fields: [authorId], references: [id])
                    authorId    String
                    pinnedBy    User?  @relation("pinned", fields: [pinnedById], references: [id])
                    pinnedById  String? @unique
                    tags        Tag[]
                }
                model Tag {
                    id    String @id @default(cuid())
                    posts Post[]
                }
                model Profile {
                    id     String @id @default(cuid())
                    user   User   @relation(fields: [userId], references: [id])
                    userId String @unique
                }
            `);
    });

    it('renders cross-reference table, Mermaid diagram, and model page links', () => {
      const relDocument = readDocument(tmpDir, 'relationships.md');
      expect(relDocument).toContain('# Relationships');
      expect(relDocument).toContain('erDiagram');
      expect(relDocument).toContain('[Index](./index.md) / Relationships');
      expect(relDocument).toContain('[User](./models/User.md)');
      expect(relDocument).toContain('[Post](./models/Post.md)');
      expect(relDocument).toContain('[Tag](./models/Tag.md)');
    });

    it('uses correct Mermaid cardinality notation for each relationship type', () => {
      const relDocument = readDocument(tmpDir, 'relationships.md');
      expect(relDocument).toContain('||--o{');
      expect(relDocument).toContain('|o--o|');
      expect(relDocument).toContain('}o--o{');
    });

    it('preserves multiple named relationships between same model pair', () => {
      const relDocument = readDocument(tmpDir, 'relationships.md');
      const mermaidSection = relDocument.split('```mermaid')[1] ?? '';
      const postUserLines = mermaidSection
        .split('\n')
        .filter((l) => l.includes('Post') && l.includes('User'));
      expect(postUserLines.length).toBeGreaterThanOrEqual(2);
    });
  });
});
