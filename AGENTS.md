# oscd-plugins

Nx workspace for OpenSCD / CoMPAS plugins. Run and playground details live in `DEVELOPMENT.md`. Each plugin keeps its own rules in `apps/<name>/AGENTS.md`.

The host loads `dist/apps/<app>/index.js`. `src/main.ts` is never that bundle.

## Working rules

- A bug that appears only in the standalone playground is fixed in `libs/global/dev` or `src/main.ts`. Leave the production plugin unchanged when it already works in OpenSCD / CoMPAS.
- SCL changes are EditV2 arrays. The playground applies them in `libs/global/dev/apply-edit.ts`, in the same order as the OpenSCD editor.
- Colors use `--oscd-plugin-internal-*` from `libs/global/oscd-theme-bridge.css`. Do not hardcode colors or redefine those tokens. Do not ship `@font-face`. The host provides the fonts.
- A new playground SCL file goes in `libs/global/dev/files/`, is registered in `libs/global/dev/playground-docs.ts`, and is listed in that plugin's `relevantDocs` in `src/main.ts`. Small files are Vite `?raw` imports. A file too large for the module graph is a `url` entry and is fetched at runtime.
- Check with `pnpm verify`, or the project's nx `lint`, `check`, and `test` targets.

## Language

Reply to the user in German. Keep notes, commits, and code comments in English and short.
