# Phase 4: Docs and Release

Goal: someone who has never seen Tenkai can install it, follow a guide, and
have something moving on screen in ten minutes.

## Examples

- [ ] `examples/` folder with a Vite dev server: at minimum
  - a top-down tile map with a controllable character (overhead perspective)
  - a 3/4-view scene showing `PERSPECTIVE_ANGLE` depth sorting
  - an input and audio demo
- [ ] Deploy the examples alongside the API docs on GitHub Pages, so each guide
      links to a running version.
- [x] Replace the README's reference to "a blank game project with an
      on-demand compiler" (it is not linked anywhere). It now links the
      getting-started guide and the examples.

## Documentation

- [ ] README: what it is, a ten-line quick start using ESM, links to guides,
      examples and API docs. Remove Browserify references.
- [x] Markdown docs in `docs/`: getting started, architecture, an examples
      walkthrough, a point-and-click guide, and a reference page per class.
- [ ] Guides still to write: input, tile maps, audio, packaging a desktop
      build.
- [ ] Update `docs/architecture.md` and the API pages for the Phase 2 and 3
      changes (Container, Camera, update/draw split, ESM).
- [ ] Desktop packaging guide: Electron still works; also mention Tauri as a
      much smaller option, and PWA install for zero-packaging distribution.
- [ ] `CHANGELOG.md` and a 0.x -> 1.0 migration note.

## Release

- [ ] Publish from GitHub Actions on tag using npm trusted publishing (OIDC),
      which also gives provenance attestations. No long-lived npm token in
      repo secrets.
- [ ] Semantic versioning from 1.0 on; Changesets or a hand-maintained
      changelog.
- [ ] Ship `types/` in the package and verify with `publint` and
      `@arethetypeswrong/cli`.
- [ ] Deprecate 0.1.x on npm with a pointer to 1.0.
- [ ] Check the package size: ESM source plus types should be well under
      100KB with no dependencies.

## Done when

- `npm create vite@latest`, `npm i tenkai`, paste the README quick start, and
  it runs.
