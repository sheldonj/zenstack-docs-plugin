# Agent Guidelines — zenstack-docs-plugin

## Project overview

ZenStack CLI plugin that generates Markdown documentation from ZModel schemas. Pure function: AST in, Markdown files out. No template engines, no runtime dependencies beyond `@zenstackhq/language` and `@zenstackhq/sdk`.

Entry point: `src/index.ts` exports a `CliPlugin`. The orchestrator is `src/generator.ts`. Each entity type has a dedicated renderer in `src/renderers/`.

## Git and commits

This project uses [Conventional Commits](https://www.conventionalcommits.org/) with [Release Please](https://github.com/googleapis/release-please) for automated versioning. Commit message format matters — it determines version bumps and changelog entries.

### Commit message format

```
<type>[optional scope]: <description>
```

### Types and their effect

| Type | Version bump | Changelog |
|---|---|---|
| `feat` | minor | visible |
| `fix` | patch | visible |
| `perf` | patch | visible |
| `docs` | none | hidden |
| `test` | none | hidden |
| `refactor` | none | hidden |
| `chore` | none | hidden |
| `ci` | none | hidden |

### Breaking changes

Append `!` after the type: `feat!: rename diagramFormat option`. This bumps major (or minor while pre-1.0).

### Branch naming

- Features: `feature/<short-description>`
- Fixes: `fix/<short-description>`
- Docs: `docs/<short-description>`
- Chores: `chore/<short-description>`

### Rules

- Never force-push to `main`.
- Never amend commits that have been pushed.
- Always create a branch and PR for changes — do not commit directly to `main`.
- PR titles should follow the same conventional commit format (GitHub uses the PR title as the merge commit message).

## Code style

### TypeScript

- Strict mode with `noUncheckedIndexedAccess` — every indexed access needs a null check or `!` assertion.
- No `any` — write type guards instead of type assertions.
- Use `function` declarations, not arrow-function expressions (the `func-style` lint rule is disabled for this reason).
- Filenames are kebab-case.
- Use `import type` for type-only imports.
- ESM only (`"type": "module"` in package.json).

### Lint

Uses `eslint-config-canonical` with project-specific overrides in `eslint.config.js`. Run `pnpm run lint` before committing. Key overrides:

- `!= null` checks are allowed (idiomatic null/undefined coalescing).
- `console` usage is allowed (CLI plugin).
- Non-null assertions (`!`) are allowed after guarded regex matches and array lookups.
- `perfectionist/sort-modules` is enforced — exported functions must come before non-exported ones, and functions should be in alphabetical order.

### Formatting

Prettier is integrated via `eslint-config-canonical`. Do not add a separate prettier config — it runs through ESLint.

## Testing

- Framework: vitest
- Run: `pnpm test`
- Tests call the public `generate()` function through helpers in `test/utils.ts`, then assert on the generated Markdown output.
- Use Red-Green TDD: write a failing test first, then implement.
- Update snapshots with `pnpm test -- --update`.

### Test helpers

| Function | Purpose |
|---|---|
| `generateFromSchema(schema, options?)` | Parse inline ZModel, generate docs to temp dir |
| `readDoc(tmpDir, ...segments)` | Read a generated doc file |
| `findFieldLine(doc, fieldName)` | Find a field's table row |
| `findBrokenLinks(outputDir)` | Verify all relative links resolve |

## Build and verify

```bash
pnpm run typecheck    # tsc --noEmit
pnpm run lint         # eslint
pnpm test             # vitest run
pnpm run build        # tsc --noEmit && tsup-node
```

Always run typecheck, lint, and test before pushing. CI runs all three on Node 20 and 22.

## Architecture notes

### Renderers

Every renderer follows the same pattern: accept AST node(s) and options, build a `string[]` where each element is one line, join with `'\n'`, return the full page. Conditional sections are omitted by not pushing lines.

### Extractors

`src/extractors.ts` contains pure functions for pulling data from the ZModel AST. Keep extraction separate from rendering.

### Diagram pipeline

Mermaid blocks in rendered markdown are post-processed by `src/renderers/diagram-processor.ts`. It supports three modes via `diagramFormat` (`mermaid`, `svg`, `both`) and two embed modes via `diagramEmbed` (`file`, `inline`). SVG rendering uses `beautiful-mermaid`.

### Adding a new plugin option

1. Add the option to `PluginOptions` in `src/types.ts`
2. Parse it in `resolvePluginOptions()` in `src/generator.ts`
3. If it controls rendering, add it to `RenderOptions` and `resolveRenderOptions()` in `src/extractors.ts`
4. Update `README.md` configuration table
5. Add tests

### Adding a new section to a page

1. Write a failing test
2. Add rendering logic to the renderer in `src/renderers/`
3. If needed, add extraction logic in `src/extractors.ts`
4. If toggleable, add a boolean to `RenderOptions`

## Dependencies

- `@zenstackhq/language` and `@zenstackhq/sdk` are **peer dependencies** — the consuming project provides them.
- `beautiful-mermaid` is the only runtime dependency (SVG rendering).
- Use `pnpm` as the package manager.
