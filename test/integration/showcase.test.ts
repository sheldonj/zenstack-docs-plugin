import { findBrokenLinks, generateFromFile, readDoc } from '../utils';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SHOWCASE_SCHEMA = path.resolve(
  __dirname,
  '../../zenstack/showcase.zmodel',
);

describe('integration: showcase schema', () => {
  it('generates expected file structure with correct model and enum counts', async () => {
    const tmpDir = await generateFromFile(SHOWCASE_SCHEMA);

    expect(fs.existsSync(path.join(tmpDir, 'index.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'relationships.md'))).toBe(true);

    const expectedModels = [
      'Activity',
      'Comment',
      'Organization',
      'Project',
      'Tag',
      'Task',
      'Team',
      'TeamMember',
      'User',
    ];
    for (const name of expectedModels) {
      expect(fs.existsSync(path.join(tmpDir, 'models', `${name}.md`))).toBe(
        true,
      );
    }

    const expectedEnums = ['Priority', 'Role', 'TaskStatus'];
    for (const name of expectedEnums) {
      expect(fs.existsSync(path.join(tmpDir, 'enums', `${name}.md`))).toBe(
        true,
      );
    }

    expect(fs.existsSync(path.join(tmpDir, 'types', 'Timestamps.md'))).toBe(
      true,
    );

    const expectedViews = [
      'UserProfile',
      'ProjectTaskSummary',
      'UserLeaderboard',
    ];
    for (const name of expectedViews) {
      expect(fs.existsSync(path.join(tmpDir, 'views', `${name}.md`))).toBe(
        true,
      );
    }

    for (const name of expectedViews) {
      expect(fs.existsSync(path.join(tmpDir, 'models', `${name}.md`))).toBe(
        false,
      );
    }

    expect(fs.existsSync(path.join(tmpDir, 'models', 'JobRun.md'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'models', 'ApiToken.md'))).toBe(
      false,
    );
  });

  it('has zero broken links across all generated files', async () => {
    const tmpDir = await generateFromFile(SHOWCASE_SCHEMA);
    const broken = findBrokenLinks(tmpDir);
    expect(broken).toEqual([]);
  });

  it('type pages render with fields, Used By, and cross-links to models', async () => {
    const tmpDir = await generateFromFile(SHOWCASE_SCHEMA);

    const tsDocument = readDoc(tmpDir, 'types', 'Timestamps.md');
    expect(tsDocument).toContain('# Timestamps');
    expect(tsDocument).toContain('[Index](../index.md)');
    expect(tsDocument).toContain('Fields');
    expect(tsDocument).toContain('field-createdAt');
    expect(tsDocument).toContain('field-updatedAt');
    expect(tsDocument).toContain('Used By');
    expect(tsDocument).toContain('[Organization](../models/Organization.md');
    expect(tsDocument).toContain('[User](../models/User.md');

    const index = readDoc(tmpDir, 'index.md');
    expect(index).toContain('Types');
    expect(index).toContain('[Timestamps](./types/Timestamps.md)');

    const userDocument = readDoc(tmpDir, 'models', 'User.md');
    expect(userDocument).toContain('Mixins');
    expect(userDocument).toContain('[Timestamps](../types/Timestamps.md)');

    const createdAtLine = userDocument
      .split('\n')
      .find((l) => l.includes('field-createdAt'));
    expect(createdAtLine).toContain('[Timestamps](../types/Timestamps.md)');
  });

  it('index page lists all visible models, enums, and relationships link', async () => {
    const tmpDir = await generateFromFile(SHOWCASE_SCHEMA);
    const index = readDoc(tmpDir, 'index.md');

    expect(index).not.toContain('JobRun');
    expect(index).not.toContain('ApiToken');

    for (const name of [
      'Activity',
      'Comment',
      'Organization',
      'Project',
      'Tag',
      'Task',
      'Team',
      'TeamMember',
      'User',
    ]) {
      expect(index).toContain(`[${name}]`);
    }

    for (const name of ['Priority', 'Role', 'TaskStatus']) {
      expect(index).toContain(`[${name}](./enums/${name}.md)`);
    }

    expect(index).toContain('[Relationships](./relationships.md)');
  });

  it('renders computed fields, enum type links, policies, validation, and indexes', async () => {
    const tmpDir = await generateFromFile(SHOWCASE_SCHEMA);

    const userDocument = readDoc(tmpDir, 'models', 'User.md');

    const taskCountLine = userDocument
      .split('\n')
      .find((l) => l.includes('field-taskCount'));
    expect(taskCountLine).toContain('<kbd>computed</kbd>');

    expect(userDocument).toContain('[Role](../enums/Role.md)');

    expect(userDocument).toContain('Access Policies');
    expect(userDocument).toContain('Allow');
    expect(userDocument).toContain('Deny');

    expect(userDocument).toContain('Indexes');

    const orgDocument = readDoc(tmpDir, 'models', 'Organization.md');
    expect(orgDocument).toContain('Validation Rules');
    expect(orgDocument).toContain('`@length`');
    expect(orgDocument).toContain('`@email`');
    expect(orgDocument).toContain('Indexes');
  });

  it('renders diverse computed fields across multiple models', async () => {
    const tmpDir = await generateFromFile(SHOWCASE_SCHEMA);

    const projectDocument = readDoc(tmpDir, 'models', 'Project.md');
    const projectLines = projectDocument.split('\n');

    const taskCountLine = projectLines.find((l) =>
      l.includes('field-taskCount'),
    );
    expect(taskCountLine).toBeDefined();
    expect(taskCountLine).toContain('`Int` <kbd>computed</kbd>');
    expect(taskCountLine).toContain('Total number of tasks');

    const completionLine = projectLines.find((l) =>
      l.includes('field-completionRate'),
    );
    expect(completionLine).toBeDefined();
    expect(completionLine).toContain('`Float` <kbd>computed</kbd>');
    expect(completionLine).toContain('Percentage of completed tasks');

    const overdueLine = projectLines.find((l) =>
      l.includes('field-hasOverdueTasks'),
    );
    expect(overdueLine).toBeDefined();
    expect(overdueLine).toContain('`Boolean` <kbd>computed</kbd>');

    const taskDocument = readDoc(tmpDir, 'models', 'Task.md');
    const taskLines = taskDocument.split('\n');

    const commentCountLine = taskLines.find((l) =>
      l.includes('field-commentCount'),
    );
    expect(commentCountLine).toBeDefined();
    expect(commentCountLine).toContain('`Int` <kbd>computed</kbd>');
    expect(commentCountLine).toContain('Number of comments');

    const orgDocument = readDoc(tmpDir, 'models', 'Organization.md');
    const orgLines = orgDocument.split('\n');

    const memberCountLine = orgLines.find((l) =>
      l.includes('field-memberCount'),
    );
    expect(memberCountLine).toBeDefined();
    expect(memberCountLine).toContain('`Int` <kbd>computed</kbd>');
  });

  it('generates view pages in views/ directory with correct content', async () => {
    const tmpDir = await generateFromFile(SHOWCASE_SCHEMA);

    const index = readDoc(tmpDir, 'index.md');
    expect(index).toContain('Views');
    expect(index).toContain('[UserProfile](./views/UserProfile.md)');
    expect(index).toContain(
      '[ProjectTaskSummary](./views/ProjectTaskSummary.md)',
    );
    expect(index).toContain('[UserLeaderboard](./views/UserLeaderboard.md)');
    expect(index).toContain('3 views');

    const profileDocument = readDoc(tmpDir, 'views', 'UserProfile.md');
    expect(profileDocument).toContain('<kbd>View</kbd>');
    expect(profileDocument).not.toContain('<kbd>Model</kbd>');
    expect(profileDocument).toContain('[Views](../index.md#views)');
    expect(profileDocument).toContain('Flattened user profile for reporting');
    expect(profileDocument).toContain('Fields');
    expect(profileDocument).toContain('field-name');
    expect(profileDocument).toContain('field-email');
    expect(profileDocument).toContain('field-organizationName');
    expect(profileDocument).toContain('field-teamCount');
    expect(profileDocument).toContain('<summary>Declaration');
    expect(profileDocument).toContain('view UserProfile');

    expect(profileDocument).toContain('Full name of the user');
    expect(profileDocument).toContain('Email address of the user');

    const summaryDocument = readDoc(tmpDir, 'views', 'ProjectTaskSummary.md');
    expect(summaryDocument).toContain('Aggregated task metrics');
    expect(summaryDocument).toContain('field-avgDaysToClose');
    expect(summaryDocument).toContain('`Float`');
  });

  it('renders @@meta category, since, and deprecated annotations', async () => {
    const tmpDir = await generateFromFile(SHOWCASE_SCHEMA);

    const orgDocument = readDoc(tmpDir, 'models', 'Organization.md');
    expect(orgDocument).toContain('**Category:** Core');
    expect(orgDocument).toContain('**Since:** 1.0');

    const userDocument = readDoc(tmpDir, 'models', 'User.md');
    expect(userDocument).toContain('**Category:** Identity');

    const activityDocument = readDoc(tmpDir, 'models', 'Activity.md');
    expect(activityDocument).toContain('**Category:** Audit');
    expect(activityDocument).toContain('**Since:** 2.0');
  });

  it('renders self-referential relations and @meta doc:example values', async () => {
    const tmpDir = await generateFromFile(SHOWCASE_SCHEMA);

    const taskDocument = readDoc(tmpDir, 'models', 'Task.md');
    expect(taskDocument).toContain('Relationships');
    expect(taskDocument).toContain('[Task](./Task.md)');

    const titleLine = taskDocument
      .split('\n')
      .find((l) => l.includes('field-title'));
    expect(titleLine).toContain('Fix login redirect bug');

    const orgDocument = readDoc(tmpDir, 'models', 'Organization.md');
    const slugLine = orgDocument
      .split('\n')
      .find((l) => l.includes('field-slug'));
    expect(slugLine).toContain('acme-corp');

    const userDocument = readDoc(tmpDir, 'models', 'User.md');
    const emailLine = userDocument
      .split('\n')
      .find((l) => l.includes('field-email'));
    expect(emailLine).toContain('jane@acme.com');
  });

  it('showcase models use diverse default-value functions (cuid, uuid, now)', async () => {
    const tmpDir = await generateFromFile(SHOWCASE_SCHEMA);

    const userDocument = readDoc(tmpDir, 'models', 'User.md');
    const userIdLine = userDocument
      .split('\n')
      .find((l) => l.includes('field-id'));
    expect(userIdLine).toContain('`cuid()`');

    const activityDocument = readDoc(tmpDir, 'models', 'Activity.md');
    const actIdLine = activityDocument
      .split('\n')
      .find((l) => l.includes('field-id'));
    expect(actIdLine).toContain('`uuid()`');

    const tsDocument = readDoc(tmpDir, 'types', 'Timestamps.md');
    const createdLine = tsDocument
      .split('\n')
      .find((l) => l.includes('field-createdAt'));
    expect(createdLine).toContain('`now()`');
  });

  it('Task model renders @@validate model-level rule in Validation Rules', async () => {
    const tmpDir = await generateFromFile(SHOWCASE_SCHEMA);

    const taskDocument = readDoc(tmpDir, 'models', 'Task.md');
    expect(taskDocument).toContain('Validation Rules');
    expect(taskDocument).toContain('estimatedHours');
    expect(taskDocument).toContain('Estimated hours must be positive when set');
  });

  it('Task model renders all validation attributes including @regex, @gt, @lte, @trim', async () => {
    const tmpDir = await generateFromFile(SHOWCASE_SCHEMA);

    const taskDocument = readDoc(tmpDir, 'models', 'Task.md');
    expect(taskDocument).toContain('✅ Validation Rules');

    const parts = taskDocument.split('✅ Validation Rules');
    expect(parts).toHaveLength(2);
    const validationSection = parts[1]!;
    expect(validationSection).toContain('`@length`');
    expect(validationSection).toContain('`@trim`');
    expect(validationSection).toContain('`@regex`');
    expect(validationSection).toContain('`@gt`');
    expect(validationSection).toContain('`@lte`');
  });

  it('enum pages show descriptions and Used By with correct links', async () => {
    const tmpDir = await generateFromFile(SHOWCASE_SCHEMA);

    const roleDocument = readDoc(tmpDir, 'enums', 'Role.md');
    expect(roleDocument).toContain('Defines the access level');
    expect(roleDocument).toContain('Full administrative access');
    expect(roleDocument).toContain('| `OWNER`');
    expect(roleDocument).toContain('| `GUEST`');
    expect(roleDocument).toContain('Used By');
    expect(roleDocument).toContain('[User](../models/User.md)');
    expect(roleDocument).toContain('[TeamMember](../models/TeamMember.md)');

    const statusDocument = readDoc(tmpDir, 'enums', 'TaskStatus.md');
    expect(statusDocument).toContain('Lifecycle status');
    expect(statusDocument).toContain('Waiting to be started');
    expect(statusDocument).toContain('Used By');
    expect(statusDocument).toContain('[Task](../models/Task.md)');

    const priorityDocument = readDoc(tmpDir, 'enums', 'Priority.md');
    expect(priorityDocument).toContain('Priority levels');
    expect(priorityDocument).toContain('| `LOW`');
    expect(priorityDocument).toContain('| `CRITICAL`');
  });

  it('relationships page has cross-reference and Mermaid diagram with links', async () => {
    const tmpDir = await generateFromFile(SHOWCASE_SCHEMA);
    const relDocument = readDoc(tmpDir, 'relationships.md');

    expect(relDocument).toContain('[Index](./index.md)');
    expect(relDocument).toContain('## Cross-Reference');
    expect(relDocument).toContain('[Organization](./models/Organization.md)');
    expect(relDocument).toContain('[User](./models/User.md)');
    expect(relDocument).toContain('[Task](./models/Task.md)');

    expect(relDocument).toContain('## Entity Relationship Diagram');
    expect(relDocument).toContain('erDiagram');
  });

  it('renders correct cardinality types for all relationship kinds', async () => {
    const tmpDir = await generateFromFile(SHOWCASE_SCHEMA);

    const tagDocument = readDoc(tmpDir, 'models', 'Tag.md');
    const tagRelSection = tagDocument.split('🔗 Relationships')[1] ?? '';
    expect(tagRelSection).toContain('Many→Many');
    const tagRelLines = tagRelSection
      .split('\n')
      .filter((l) => l.startsWith('|'));
    const tagTasksLine = tagRelLines.find((l) => l.includes('`tasks`'));
    expect(tagTasksLine).toContain('Many→Many');
    const tagProjectsLine = tagRelLines.find((l) => l.includes('`projects`'));
    expect(tagProjectsLine).toContain('Many→Many');

    const taskDocument = readDoc(tmpDir, 'models', 'Task.md');
    const taskRelSection = taskDocument.split('🔗 Relationships')[1] ?? '';
    const taskRelLines = taskRelSection
      .split('\n')
      .filter((l) => l.startsWith('|'));
    const taskParentLine = taskRelLines.find((l) => l.includes('`parent`'));
    expect(taskParentLine).toContain('Many→One?');
    const taskChildrenLine = taskRelLines.find((l) => l.includes('`children`'));
    expect(taskChildrenLine).toContain('One→Many');
    const taskAssigneeLine = taskRelLines.find((l) => l.includes('`assignee`'));
    expect(taskAssigneeLine).toContain('Many→One?');

    const relDocument = readDoc(tmpDir, 'relationships.md');
    expect(relDocument).toContain('Many→Many');
    expect(relDocument).toContain('}o--o{');
  });

  it('renders correct Mermaid connectors for Many→Many and optional relations', async () => {
    const tmpDir = await generateFromFile(SHOWCASE_SCHEMA);

    const relDocument = readDoc(tmpDir, 'relationships.md');
    expect(relDocument).toContain('}o--o{');

    const tagDocument = readDoc(tmpDir, 'models', 'Tag.md');
    expect(tagDocument).toContain('}o--o{');
  });

  it('models without descriptions still render correctly', async () => {
    const tmpDir = await generateFromFile(SHOWCASE_SCHEMA);

    const tagDocument = readDoc(tmpDir, 'models', 'Tag.md');
    expect(tagDocument).toContain('# 🗃️ Tag');
    expect(tagDocument).toContain('Fields');
    expect(tagDocument).toContain('field-name');
    expect(tagDocument).toContain('[Index](../index.md)');
  });

  it('generates procedure pages for all declared procedures', async () => {
    const tmpDir = await generateFromFile(SHOWCASE_SCHEMA);

    const expectedProcedures = [
      'signUp',
      'getUser',
      'listOrgUsers',
      'createAndAssignTask',
      'getProjectStats',
      'bulkUpdateTaskStatus',
      'archiveProject',
    ];

    for (const name of expectedProcedures) {
      expect(fs.existsSync(path.join(tmpDir, 'procedures', `${name}.md`))).toBe(
        true,
      );
    }

    const index = readDoc(tmpDir, 'index.md');
    expect(index).toContain('Procedures');
    for (const name of expectedProcedures) {
      expect(index).toContain(`[${name}](./procedures/${name}.md)`);
    }

    expect(index).toContain('7 procedures');
  });

  it('procedure pages have correct content for mutations and queries', async () => {
    const tmpDir = await generateFromFile(SHOWCASE_SCHEMA);

    const signUpDocument = readDoc(tmpDir, 'procedures', 'signUp.md');
    expect(signUpDocument).toContain('# signUp');
    expect(signUpDocument).toContain('<kbd>Mutation</kbd>');
    expect(signUpDocument).toContain('Register a new user');
    expect(signUpDocument).toContain('Parameters');
    expect(signUpDocument).toContain('| `email`');
    expect(signUpDocument).toContain('| `name`');
    expect(signUpDocument).toContain('| `role`');
    expect(signUpDocument).toContain('Returns');
    expect(signUpDocument).toContain('[User](../models/User.md)');

    const getUserDocument = readDoc(tmpDir, 'procedures', 'getUser.md');
    expect(getUserDocument).toContain('# getUser');
    expect(getUserDocument).toContain('<kbd>Query</kbd>');
    expect(getUserDocument).toContain('Returns');
    expect(getUserDocument).toContain('[User](../models/User.md)');

    const bulkDocument = readDoc(
      tmpDir,
      'procedures',
      'bulkUpdateTaskStatus.md',
    );
    expect(bulkDocument).toContain('<kbd>Mutation</kbd>');
    expect(bulkDocument).toContain('| `taskIds`');
    expect(bulkDocument).toContain('| `status`');
    expect(bulkDocument).toContain('`Void`');

    const statsDocument = readDoc(tmpDir, 'procedures', 'getProjectStats.md');
    expect(statsDocument).toContain('<kbd>Query</kbd>');
    expect(statsDocument).toContain('[ProjectStats](../types/ProjectStats.md)');
  });

  it('procedure pages link to return types and param types correctly', async () => {
    const tmpDir = await generateFromFile(SHOWCASE_SCHEMA);

    const signUpDocument = readDoc(tmpDir, 'procedures', 'signUp.md');
    expect(signUpDocument).toContain('[Role](../enums/Role.md)');
    expect(signUpDocument).toContain('[User](../models/User.md)');

    const createDocument = readDoc(
      tmpDir,
      'procedures',
      'createAndAssignTask.md',
    );
    expect(createDocument).toContain('[Priority](../enums/Priority.md)');
    expect(createDocument).toContain('[Task](../models/Task.md)');
  });

  it('model pages show Used in Procedures backlinks', async () => {
    const tmpDir = await generateFromFile(SHOWCASE_SCHEMA);

    const userDocument = readDoc(tmpDir, 'models', 'User.md');
    expect(userDocument).toContain('Used in Procedures');
    expect(userDocument).toContain('[signUp](../procedures/signUp.md)');
    expect(userDocument).toContain('[getUser](../procedures/getUser.md)');
    expect(userDocument).toContain(
      '[listOrgUsers](../procedures/listOrgUsers.md)',
    );

    const taskDocument = readDoc(tmpDir, 'models', 'Task.md');
    expect(taskDocument).toContain('Used in Procedures');
    expect(taskDocument).toContain(
      '[createAndAssignTask](../procedures/createAndAssignTask.md)',
    );
  });

  it('procedure pages have collapsible declarations and source paths', async () => {
    const tmpDir = await generateFromFile(SHOWCASE_SCHEMA);

    const signUpDocument = readDoc(tmpDir, 'procedures', 'signUp.md');
    expect(signUpDocument).toContain('<summary>Declaration');
    expect(signUpDocument).toContain('mutation procedure signUp');
    expect(signUpDocument).toContain('**Defined in:**');
    expect(signUpDocument).toContain('.zmodel');
  });

  it('generates SKILL.md with comprehensive content when generateSkill=true', async () => {
    const tmpDir = await generateFromFile(SHOWCASE_SCHEMA, {
      generateSkill: true,
    });

    const skill = readDoc(tmpDir, 'SKILL.md');

    // Frontmatter
    expect(skill).toMatch(/^---\n/u);
    expect(skill).toContain('name:');
    expect(skill).toContain('description:');

    // Overview lists ALL entities with type labels
    expect(skill).toContain('## Schema Overview');
    expect(skill).toContain('9 models');
    expect(skill).toContain('3 enums');
    expect(skill).toContain('2 types');
    expect(skill).toContain('3 views');
    expect(skill).toContain('7 procedures');
    expect(skill).toContain('Entities:');
    expect(skill).toContain('**User** (Model)');
    expect(skill).toContain('**Organization** (Model)');
    expect(skill).toContain('**UserProfile** (View)');
    expect(skill).not.toContain('...and');

    // Conventions
    expect(skill).toContain('## Conventions');
    expect(skill).toContain('**IDs**');
    expect(skill).toContain('**Mixins**');
    expect(skill).toContain('Timestamps');
    expect(skill).toContain('**Computed fields**');

    // Constraints
    expect(skill).toContain('## Constraints You Must Respect');
    expect(skill).toContain('### Access Policies');
    expect(skill).toContain("allow('read', true)");
    expect(skill).toContain('### Validation');
    expect(skill).toContain('@email');
    expect(skill).toContain('@length');

    // Workflow
    expect(skill).toContain('## How To Use This Schema');
    expect(skill).toContain('### Calling procedures');
    expect(skill).toContain('signUp');
    expect(skill).toContain('mutation');
    expect(skill).toContain('getUser');
    expect(skill).toContain('query');

    // Entity Reference: full declarations in prisma code blocks
    expect(skill).toContain('## Entity Reference');
    expect(skill).toContain('### Models');
    expect(skill).toContain('#### User');
    expect(skill).toContain('#### Organization');
    expect(skill).toContain('#### Task');
    expect(skill).toContain('```prisma');
    expect(skill).toContain('model User');
    expect(skill).toContain('model Organization');
    expect(skill).toContain('### Enums');
    expect(skill).toContain('#### Role');
    expect(skill).toContain('enum Role {');
    expect(skill).toContain('#### Priority');
    expect(skill).toContain('#### TaskStatus');
    expect(skill).toContain('### Types');
    expect(skill).toContain('#### Timestamps');
    expect(skill).toContain('type Timestamps {');
    expect(skill).toContain('#### ProjectStats');
    expect(skill).toContain('### Views');
    expect(skill).toContain('#### UserProfile');
    expect(skill).toContain('view UserProfile {');

    // Relationships inline under models
    expect(skill).toContain('Relationships:');

    // Links use entity name and type, not "Full documentation"
    expect(skill).toContain('[User (Model)](./models/User.md)');
    expect(skill).toContain('[Role (Enum)](./enums/Role.md)');
    expect(skill).toContain('[Timestamps (Type)](./types/Timestamps.md)');
    expect(skill).toContain('[UserProfile (View)](./views/UserProfile.md)');
    expect(skill).not.toContain('[Full documentation]');

    // Footer
    expect(skill).toContain('## Detailed Documentation');
    expect(skill).toContain('[Full schema index](./index.md)');
    expect(skill).toContain(
      '[Relationships and ER diagrams](./relationships.md)',
    );
    expect(skill).toContain('procedures/signUp.md');
  });

  it('does not generate SKILL.md by default', async () => {
    const tmpDir = await generateFromFile(SHOWCASE_SCHEMA);
    expect(fs.existsSync(path.join(tmpDir, 'SKILL.md'))).toBe(false);
  });

  it('includeInternalModels=true includes @@ignore models in output', async () => {
    const tmpDir = await generateFromFile(SHOWCASE_SCHEMA, {
      includeInternalModels: true,
    });

    const index = readDoc(tmpDir, 'index.md');
    expect(index).toContain('[JobRun]');
    expect(index).toContain('[ApiToken]');
    expect(fs.existsSync(path.join(tmpDir, 'models', 'JobRun.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'models', 'ApiToken.md'))).toBe(
      true,
    );

    expect(findBrokenLinks(tmpDir)).toEqual([]);
  });
});
