import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['player/test/setup-library.ts'],
    include: ['tools/test/**/*.test.ts', 'player/test/**/*.test.ts'],
  },
});
