# oscd-publisher

Lit plugin (`static styles` in the bundle). Production entry is `src/oscd-publisher.ts`. The playground defines `oscd-publisher-dev` from `src/main.ts` only.

## Edits

`scl-lib` sends EditV2 batches, and attribute edits omit `attributesNS`. Do not apply them with `@openenergytools/xml-lib` `handleEdit`: version 1.2.2 treats an edit as attributes only when `attributesNS` is present. The playground uses `libs/global/dev/apply-edit.ts` instead.

## Tests

Lit editor specs (`*-editor.spec.ts`) are skipped under Node. jsdom and happy-dom have no Material Web `ElementInternals`. Utility `*.spec.ts` files still run under Vitest.
