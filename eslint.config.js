import auto from 'eslint-config-canonical/auto';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  auto,
  {
    rules: {
      // non-null assertions are used deliberately after regex matches and array lookups
      // that are guarded by the surrounding logic
      '@typescript-eslint/no-non-null-assertion': 'off',

      'canonical/filename-match-exported': 'off',

      // canonical enforces camelCase filenames; the project already uses kebab-case consistently
      'canonical/filename-match-regex': 'off',

      // canonical wants every identifier to match a specific pattern
      'canonical/id-match': 'off',

      eqeqeq: ['error', 'always', { null: 'ignore' }],

      // canonical prefers arrow-function expressions; this project uses function declarations consistently
      'func-style': 'off',
      // short names in lambdas (e.g., `(a, b) => a.name.localeCompare(b.name)`) are fine
      'id-length': 'off',

      // this is a CLI plugin; console output is expected
      'no-console': 'off',

      // we use `!= null` checks which are idiomatic for coalescing null/undefined
      'no-eq-null': 'off',

      // prefers `.toSorted()` over `.sort()` — unnecessary churn for this project
      'unicorn/no-array-sort': 'off',
      // too aggressive — renames `rel` → `relationship`, `doc` → `document`, `tmpDir` → `temporaryDirectory`
      'unicorn/prevent-abbreviations': 'off',
    },
  },
  {
    ignores: ['dist/', 'preview-output/', 'zenstack/'],
  },
);
