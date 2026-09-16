import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    /* The engine is plain TypeScript with no DOM dependencies, so the tests
       run in Node. If UI component tests are added later, give those files a
       jsdom environment with a `// @vitest-environment jsdom` comment. */
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
