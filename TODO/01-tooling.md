# Phase 1: Tooling

Goal: the project builds, tests, lints and publishes the way a 2026 JavaScript
library does. Library behaviour should not change in this phase.

## Runtime and package

- [ ] `engines.node: ">=24"` (current LTS) for development tooling. Add
      `.nvmrc` / `.node-version`.
- [ ] Convert to ESM: `"type": "module"`, `import` / `export` throughout,
      `index.js` re-exports with named exports.
- [ ] Add an `exports` map in `package.json` (`"."` -> `./index.js`, plus
      `types`). Add `"files"` so only `lib/`, `index.js` and types are
      published; `"sideEffects": false`.
- [ ] Delete `package-lock.json` and regenerate from scratch once dependencies
      are replaced (the current lockfile is mostly for tools being removed).

## Types

- [ ] Add `tsconfig.json` with `allowJs`, `checkJs`, `strict`, `noEmit` for
      checking, plus a separate emit config for `declaration` +
      `emitDeclarationOnly` into `types/`.
- [ ] Fix the type errors that surface. Expect many in the mixin code; that is
      a signal for Phase 2, not something to fight here (`// @ts-expect-error`
      with a TODO is fine for now).
- [ ] Move `lib/jsdoc/*.js` typedefs into a single `lib/types.js` (or `.d.ts`).

## Tests

- [ ] Replace Jasmine 2.8 + nyc with Vitest (built-in v8 coverage). The specs
      are Jasmine-style `describe` / `it` / `expect`; most of the migration is
      `spyOn` -> `vi.spyOn` and matcher renames.
- [ ] Use Vitest browser mode (Playwright provider) for anything touching the
      canvas or DOM events. Mocked contexts are why the Phase 0 boot bug was
      invisible to 191 passing tests.
- [ ] Keep `spec/mocks/ContextMock2D.js` only for pure draw-order assertions.

## Lint and format

- [ ] Replace ESLint 5 with ESLint 9 flat config using `neostandard` (the
      maintained successor to `standard`, matching the existing JS Standard
      style). Alternatively Biome for lint + format in one tool.
- [ ] Normalise indentation: JSDoc blocks currently use tabs inside
      2-space-indented code.

## CI

- [ ] Remove `.travis.yml` and `.coveralls.yml`.
- [ ] GitHub Actions workflow: install, lint, typecheck, test (Node 24 for
      tooling; browser tests in Chromium, Firefox, WebKit via Playwright).
- [ ] Coverage: either upload to Coveralls/Codecov from Actions or just publish
      the summary in the job output. Drop `coveralls` from the `test` script so
      local `npm test` does not try to upload.
- [ ] Dependabot or Renovate for the dev dependencies.

## Docs build

- [x] Stop committing generated `docs/*.html`, fonts and scripts. `docs/` is
      now hand-written Markdown only, and `npm run gendocs` writes JSDoc HTML
      to the ignored `build/jsdoc`.
- [ ] Build the API docs in CI and deploy to GitHub Pages via
      `actions/deploy-pages`.
- [x] Keep hand-written docs as Markdown in the repo (`docs/`).
- [ ] Choose: keep JSDoc (works with current comments) or move to TypeDoc
      (better output, reads JSDoc in JS files with `allowJs`). TypeDoc is the
      likely winner once types are generated.

## Done when

- `npm run lint`, `npm run typecheck`, `npm test` all pass locally and in
  Actions on a clean clone.
- Docs site deploys from `master` without any generated files in git.
