import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/* GitHub Pages serves a project site from a subdirectory named after the
   repository, so the deployed app lives at /SimForever/ and every asset URL
   the bundler writes has to carry that prefix. A production build is the only
   thing that needs it: the dev server is the site root, and keeping it at `/`
   leaves `npm run dev` reachable at http://localhost:5173/ as it always was.

   `mode` distinguishes them rather than `command`, because `vite preview`
   resolves config with command 'serve' but mode 'production' — and preview
   serves the built HTML, whose asset paths already have the prefix baked in.
   Keying off `command` would serve those files from a root-based server and
   every asset would 404.

   If the app ever moves to a custom domain or a user site, this becomes '/'. */
const GITHUB_PAGES_BASE = '/SimForever/';

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? GITHUB_PAGES_BASE : '/',
  plugins: [react()],
  test: {
    /* The engine is plain TypeScript with no DOM dependencies, so the tests
       run in Node. If UI component tests are added later, give those files a
       jsdom environment with a `// @vitest-environment jsdom` comment. */
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}));
