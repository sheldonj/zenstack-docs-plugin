import { generateFromSchema, readDoc as readDocument } from '../utils';
import { describe, expect, it } from 'vitest';

function stabilize(content: string): string {
  return content
    .replaceAll(
      /zenstack-schema-[\da-f-]+\.zmodel/gu,
      'zenstack-schema-<UUID>.zmodel',
    )
    .replaceAll(
      /[^\s"')`]*[/\\]zenstack-schema-[^\s"')`]+\.zmodel/gu,
      '<REDACTED>.zmodel',
    )
    .replaceAll(
      /\*\*Duration\*\* \| [\d.]+ ms/gu,
      '**Duration** | <REDACTED> ms',
    )
    .replaceAll(
      /\*\*Generated\*\* \| \d{4}-\d{2}-\d{2}/gu,
      '**Generated** | <REDACTED>',
    )
    .replaceAll(/Generated:\*\* \d{4}-\d{2}-\d{2}/gu, 'Generated:** <REDACTED>')
    .replaceAll(/Generated: \d{4}-\d{2}-\d{2}/gu, 'Generated: <REDACTED>');
}

describe('documentation plugin: snapshot', () => {
  it('snapshot: full representative schema output', async () => {
    const tmpDir = await generateFromSchema(`
            /// User roles in the system.
            enum Role {
                /// Administrator with full access
                ADMIN
                /// Standard user
                USER
            }

            /// Represents a registered user.
            model User {
                id    String @id @default(cuid())
                /// User's email address.
                email String @unique @email
                /// Display name shown in the UI.
                name  String
                role  Role
                posts Post[]

                @@allow('read', true)
                @@deny('delete', true)
                @@index([email])
                @@meta('doc:category', 'Identity')
                @@meta('doc:since', '1.0')
            }

            /// A blog post.
            model Post {
                id       String @id @default(cuid())
                /// The post title.
                title    String
                content  String?
                author   User   @relation(fields: [authorId], references: [id])
                authorId String

                @@meta('doc:category', 'Content')
            }
        `);

    const indexContent = stabilize(readDocument(tmpDir, 'index.md'));
    const userDocument = stabilize(readDocument(tmpDir, 'models', 'User.md'));
    const postDocument = stabilize(readDocument(tmpDir, 'models', 'Post.md'));
    const roleDocument = stabilize(readDocument(tmpDir, 'enums', 'Role.md'));
    const relDocument = stabilize(readDocument(tmpDir, 'relationships.md'));

    expect(indexContent).toMatchSnapshot('index.md');
    expect(userDocument).toMatchSnapshot('models/User.md');
    expect(postDocument).toMatchSnapshot('models/Post.md');
    expect(roleDocument).toMatchSnapshot('enums/Role.md');
    expect(relDocument).toMatchSnapshot('relationships.md');
  });
});
