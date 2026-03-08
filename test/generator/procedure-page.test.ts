import { generateFromSchema, readDoc as readDocument } from '../utils';
import { beforeAll, describe, expect, it } from 'vitest';

describe('documentation plugin: procedure page', () => {
  describe('procedure pages', () => {
    let tmpDir: string;
    beforeAll(async () => {
      tmpDir = await generateFromSchema(`
                model User {
                    id String @id @default(cuid())
                }
                enum Role { ADMIN USER }
                type Stats {
                    total Int
                }
                /// Register a new user.
                mutation procedure signUp(email: String, name: String, role: Role?): User
                procedure getUser(id: String): User
                mutation procedure deleteUser(id: String): Void
                procedure listUsers(): User[]
                mutation procedure clearCache(): Void
                procedure getStats(): Stats
                mutation procedure setRole(userId: String, role: Role): User
            `);
    });

    it('renders mutation page with heading, badge, description, params, returns, declaration, and flowchart', () => {
      const procDocument = readDocument(tmpDir, 'procedures', 'signUp.md');
      expect(procDocument).toContain('# signUp');
      expect(procDocument).toContain('<kbd>Mutation</kbd>');
      expect(procDocument).toContain('Register a new user.');
      expect(procDocument).toContain('[Index](../index.md)');

      expect(procDocument).toContain('Parameters');
      expect(procDocument).toContain('| `email`');
      expect(procDocument).toContain('| `name`');
      expect(procDocument).toContain('| `role`');
      const roleLine = procDocument
        .split('\n')
        .find((l: string) => l.includes('| `role`'));
      expect(roleLine).toContain('No');

      expect(procDocument).toContain('Returns');
      expect(procDocument).toContain('User');

      expect(procDocument).toContain('<details>');
      expect(procDocument).toContain('<summary>Declaration');
      expect(procDocument).toContain('```prisma');
      expect(procDocument).toContain('mutation procedure signUp');
      expect(procDocument).toContain('</details>');

      expect(procDocument).toContain('```mermaid');
      expect(procDocument).toContain('flowchart LR');
      expect(procDocument).toContain('signUp');
    });

    it('renders query page with query badge', () => {
      const procDocument = readDocument(tmpDir, 'procedures', 'getUser.md');
      expect(procDocument).toContain('# getUser');
      expect(procDocument).toContain('<kbd>Query</kbd>');
      expect(procDocument).not.toContain('<kbd>Mutation</kbd>');
    });

    it('handles Void and array return types and no-params procedures', () => {
      const deleteDocument = readDocument(
        tmpDir,
        'procedures',
        'deleteUser.md',
      );
      expect(deleteDocument).toContain('`Void`');

      const listDocument = readDocument(tmpDir, 'procedures', 'listUsers.md');
      expect(listDocument).toContain('User');
      expect(listDocument).not.toContain('Parameters');

      const cacheDocument = readDocument(tmpDir, 'procedures', 'clearCache.md');
      expect(cacheDocument).toContain('```mermaid');
      expect(cacheDocument).toContain('flowchart LR');
      expect(cacheDocument).toContain('Void');
    });

    it('wraps scalar return types with modifiers in backticks as a single unit', async () => {
      const dir = await generateFromSchema(`
                model User {
                    id String @id @default(cuid())
                }
                procedure listTags(): String[]
            `);
      const procDocument = readDocument(dir, 'procedures', 'listTags.md');
      expect(procDocument).toContain('`String[]`');
      expect(procDocument).not.toContain('`String`[]');
    });

    it('links return types and param types to model, type, and enum pages', () => {
      expect(readDocument(tmpDir, 'procedures', 'getUser.md')).toContain(
        '[User](../models/User.md)',
      );
      expect(readDocument(tmpDir, 'procedures', 'getStats.md')).toContain(
        '[Stats](../types/Stats.md)',
      );

      const setRoleDocument = readDocument(tmpDir, 'procedures', 'setRole.md');
      const roleLine = setRoleDocument
        .split('\n')
        .find((l: string) => l.includes('| `role`'));
      expect(roleLine).toContain('[Role](../enums/Role.md)');
    });

    it('shows Defined In before Parameters and includes external docs link', () => {
      const procDocument = readDocument(tmpDir, 'procedures', 'getUser.md');
      expect(procDocument).toContain('**Defined in:**');
      expect(procDocument).toContain('.zmodel');
      expect(procDocument).toContain('zenstack.dev');

      const definedIndex = procDocument.indexOf('**Defined in:**');
      const parametersIndex = procDocument.indexOf('Parameters');
      const returnsIndex = procDocument.indexOf('Returns');
      if (parametersIndex !== -1) {
        expect(definedIndex).toBeLessThan(parametersIndex);
      }

      expect(definedIndex).toBeLessThan(returnsIndex);
    });
  });
});
