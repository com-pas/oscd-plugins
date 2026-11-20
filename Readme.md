# OpenSCD plugins

Monorepo for OpenSCD / CoMPAS plugins. Each plugin lives under `apps/<name>/`. Shared code lives under `libs/`.

The host loads one file per plugin: `dist/apps/<name>/index.js`. CSS is inlined. The playground entry `src/main.ts` is not that file.

Colors use the host theme tokens (`--oscd-theme-*`), mapped once to `--oscd-plugin-internal-*`. The plugin does not ship its own fonts. The host provides them.

## Scripts

```bash
pnpm install
pnpm verify
```

`pnpm verify` runs lint, typecheck, and tests. `pnpm build` builds every plugin. With no plugin in the workspace yet, the build exits successfully and writes nothing under `dist/apps/`.

Plugin run and preview scripts are added with each plugin. See [DEVELOPMENT.md](DEVELOPMENT.md).

## Release

Pushing `main` deploys each built plugin to `gh-pages` at `compas/plugins/<plugin>/snapshot/`. A manually started GitHub Action, **Release Plugin**, publishes one plugin. The inputs are the plugin name and `MAJOR`, `MINOR`, or `PATCH` (default `MINOR`).

The action reads the snapshot `index.js` and the commit SHA recorded with it. It refuses to publish when the snapshot or the SHA is missing, the SHA is not on `main`, that commit is already tagged for this plugin, or the same `index.js` is already stored under a version folder.

Otherwise it copies the snapshot to `compas/plugins/<plugin>/<version>/` and tags `<plugin>-<version>` on the recorded commit. Older versions stay. npm is not part of this release.

The `gh-pages` branch must exist before the first deploy.
