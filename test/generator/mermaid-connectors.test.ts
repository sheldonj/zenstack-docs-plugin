import { relationToMermaid } from '../../src/renderers/erd';
import { type RelationType } from '../../src/types';
import { describe, expect, it } from 'vitest';

describe('relationToMermaid: maps RelationType to Mermaid ER connectors', () => {
  const cases: Array<{
    expected: string;
    field: string;
    from: string;
    to: string;
    type: RelationType;
  }> = [
    {
      expected: '    User ||--o{ Post : "posts"',
      field: 'posts',
      from: 'User',
      to: 'Post',
      type: 'One→Many',
    },
    {
      expected: '    Post }o--|| User : "author"',
      field: 'author',
      from: 'Post',
      to: 'User',
      type: 'Many→One',
    },
    {
      expected: '    Task }o--o| User : "assignee"',
      field: 'assignee',
      from: 'Task',
      to: 'User',
      type: 'Many→One?',
    },
    {
      expected: '    Profile ||--|| User : "user"',
      field: 'user',
      from: 'Profile',
      to: 'User',
      type: 'One→One',
    },
    {
      expected: '    User |o--o| Profile : "profile"',
      field: 'profile',
      from: 'User',
      to: 'Profile',
      type: 'One→One?',
    },
    {
      expected: '    Tag }o--o{ Task : "tasks"',
      field: 'tasks',
      from: 'Tag',
      to: 'Task',
      type: 'Many→Many',
    },
  ];

  for (const { expected, field, from, to, type } of cases) {
    it(`renders ${type} as "${expected.trim()}"`, () => {
      expect(relationToMermaid({ field, from, to, type })).toBe(expected);
    });
  }
});

describe('self-referential dedup in ERD', () => {
  it('does not collapse self-referential relationships into a single connector', async () => {
    const { buildFullErDiagram } = await import('../../src/renderers/erd');
    const { isDataModel } = await import('@zenstackhq/language/ast');
    const { loadSchema } = await import('../utils');

    const model = await loadSchema(`
            model Category {
                id       String     @id @default(cuid())
                name     String
                parent   Category?  @relation("SubCategories", fields: [parentId], references: [id])
                parentId String?
                children Category[] @relation("SubCategories")
            }
        `);

    const { collectRelationships } = await import('../../src/extractors');
    const models = model.declarations.filter(isDataModel);
    const rels = collectRelationships(models);
    const erd = buildFullErDiagram({ models, relations: rels });

    const connectorLines = erd
      .split('\n')
      .filter((l) => l.includes('Category') && l.includes(' : '));
    expect(connectorLines.length).toBeGreaterThanOrEqual(1);
    expect(
      connectorLines.some(
        (l) => l.includes('Category') && l.includes('Category'),
      ),
    ).toBe(true);
  });
});
