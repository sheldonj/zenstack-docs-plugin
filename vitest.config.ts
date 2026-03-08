import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    hookTimeout: 100_000,
    include: ['**/*.test.ts'],
    testTimeout: 100_000,
  },
});
