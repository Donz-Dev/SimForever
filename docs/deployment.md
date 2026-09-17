# Deployment

The app is entirely client-side — no server, no database, no API keys, no
router. A build is a folder of static files, which is why hosting it is nearly
free of moving parts.

## How it publishes

[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) runs on every
push to `main`. It type checks, runs the full test suite, builds, and publishes
the result to GitHub Pages at <https://donz-dev.github.io/SimForever/>.

Nothing is ever published from a laptop. The live site is always a commit on
`main` that passed its tests.

The workflow re-runs the checks rather than trusting CI. CI runs on the same
commit, but in parallel, and this workflow cannot see its result — so without
that duplicated minute a broken build could reach the live site.

## The one manual setting

GitHub Pages has to be switched on by hand, once, and no commit can do it:

> Settings → Pages → Build and deployment → Source → **GitHub Actions**

Until that is set the deploy job fails with "Pages is not enabled". CI and
everything else are unaffected.

## Why a production build has a path prefix

A Pages *project* site is served from a subdirectory named after the repository,
so the app lives at `/SimForever/` rather than at the domain root. Every asset
URL the bundler writes has to carry that prefix, which is what `base` in
[`vite.config.ts`](../vite.config.ts) sets.

The base is keyed off Vite's **`mode`**, not its `command`:

```
serve / development -> base /            npm run dev
build / production  -> base /SimForever/ npm run build
serve / production  -> base /SimForever/ npm run preview
```

That third row is the reason. `vite preview` is a *serve* command in
*production* mode, and it serves the already-built HTML whose asset paths have
the prefix baked in. Keying off `command` would hand those prefixed paths to a
root-based server and 404 every one of them.

The dev server is unaffected and stays at the root, so `npm run dev` is still
<http://localhost:5173/>. `npm run preview` is the only local command that
reproduces the deployed paths — use it to check anything that touches asset
URLs, and note that it serves at <http://localhost:4173/SimForever/>.

## Moving somewhere else

A custom domain, or a `donz-dev.github.io` user site, serves from the root. Both
mean setting `base` back to `'/'`; nothing else in the app depends on the
prefix.

Adding a second host later (Cloudflare Pages and Netlify both give per-PR
preview URLs, which Pages does not) needs the same change, and can run alongside
Pages rather than replacing it.
