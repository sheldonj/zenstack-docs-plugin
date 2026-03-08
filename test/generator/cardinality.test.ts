import { collectRelationships } from '../../src/extractors';
import { type Relationship } from '../../src/types';
import { loadSchema } from '../utils';
import { isDataModel } from '@zenstackhq/language/ast';
import { beforeAll, describe, expect, it } from 'vitest';

function findRel(
  rels: Relationship[],
  from: string,
  field: string,
): Relationship | undefined {
  return rels.find((r) => r.from === from && r.field === field);
}

describe('collectRelationships: cardinality detection', () => {
  describe('one-to-many / many-to-one (standard)', () => {
    let rels: Relationship[];

    beforeAll(async () => {
      const model = await loadSchema(`
                model User {
                    id    String @id @default(cuid())
                    posts Post[]
                }
                model Post {
                    id       String @id @default(cuid())
                    author   User   @relation(fields: [authorId], references: [id])
                    authorId String
                }
            `);
      const models = model.declarations.filter(isDataModel);
      rels = collectRelationships(models);
    });

    it('detects One→Many on the array side', () => {
      expect(findRel(rels, 'User', 'posts')?.type).toBe('One→Many');
    });

    it('detects Many→One on the FK side', () => {
      expect(findRel(rels, 'Post', 'author')?.type).toBe('Many→One');
    });
  });

  describe('one-to-one (unique FK)', () => {
    let rels: Relationship[];

    beforeAll(async () => {
      const model = await loadSchema(`
                model User {
                    id      String   @id @default(cuid())
                    profile Profile?
                }
                model Profile {
                    id     String @id @default(cuid())
                    user   User   @relation(fields: [userId], references: [id])
                    userId String @unique
                }
            `);
      const models = model.declarations.filter(isDataModel);
      rels = collectRelationships(models);
    });

    it('detects One→One on the FK side with @unique', () => {
      expect(findRel(rels, 'Profile', 'user')?.type).toBe('One→One');
    });

    it('detects One→One? on the optional back-reference side', () => {
      expect(findRel(rels, 'User', 'profile')?.type).toBe('One→One?');
    });
  });

  describe('many-to-many (implicit)', () => {
    let rels: Relationship[];

    beforeAll(async () => {
      const model = await loadSchema(`
                model Tag {
                    id    String @id @default(cuid())
                    name  String
                    tasks Task[]
                }
                model Task {
                    id   String @id @default(cuid())
                    title String
                    tags Tag[]
                }
            `);
      const models = model.declarations.filter(isDataModel);
      rels = collectRelationships(models);
    });

    it('detects Many→Many on both sides', () => {
      expect(findRel(rels, 'Tag', 'tasks')?.type).toBe('Many→Many');
      expect(findRel(rels, 'Task', 'tags')?.type).toBe('Many→Many');
    });
  });

  describe('optional many-to-one', () => {
    let rels: Relationship[];

    beforeAll(async () => {
      const model = await loadSchema(`
                model User {
                    id    String @id @default(cuid())
                    tasks Task[]
                }
                model Task {
                    id         String @id @default(cuid())
                    assignee   User?  @relation(fields: [assigneeId], references: [id])
                    assigneeId String?
                }
            `);
      const models = model.declarations.filter(isDataModel);
      rels = collectRelationships(models);
    });

    it('detects Many→One? on the optional FK side', () => {
      expect(findRel(rels, 'Task', 'assignee')?.type).toBe('Many→One?');
    });

    it('detects One→Many on the array side', () => {
      expect(findRel(rels, 'User', 'tasks')?.type).toBe('One→Many');
    });
  });

  describe('self-referential', () => {
    let rels: Relationship[];

    beforeAll(async () => {
      const model = await loadSchema(`
                model Category {
                    id       String     @id @default(cuid())
                    parent   Category?  @relation("SubCategories", fields: [parentId], references: [id])
                    parentId String?
                    children Category[] @relation("SubCategories")
                }
            `);
      const models = model.declarations.filter(isDataModel);
      rels = collectRelationships(models);
    });

    it('detects Many→One? on the optional self-ref FK side', () => {
      expect(findRel(rels, 'Category', 'parent')?.type).toBe('Many→One?');
    });

    it('detects One→Many on the array self-ref side', () => {
      expect(findRel(rels, 'Category', 'children')?.type).toBe('One→Many');
    });
  });
});
