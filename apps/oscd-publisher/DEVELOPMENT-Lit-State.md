# State in oscd-publisher (Lit)

`oscd-publisher` does not use Svelte runes or `@lit-labs/signals`. Each editor is a `LitElement`. Assigning a `@property` or `@state` field schedules one render. Lit then diffs the template against the DOM.

The table below maps Lit fields to the Svelte 5 rune that would do the same job. This repo does not use those runes.

## Where state lives

The SCL document is not copied into a store. The host passes the live `XMLDocument` as `doc` and increments `editCount` after every edit. The plugin reads the XML during `render()` and writes by dispatching an `oscd-edit-v2` event (`newEditEvent` from `@openenergytools/open-scd-core`).

| Field | Decorator | Role |
|-------|-----------|------|
| `doc`, `editCount`, `element`, `searchValue` | `@property` | Public input from the parent. Set in the template (`.doc=${this.doc}`, `editCount="${this.editCount}"`). |
| `publisherType`, `selectedDataSet`, `selectedIed`, form dirty flags | `@state` | Internal UI state. Same update mechanism as `@property`, but not an HTML attribute. |
| `name`, `desc`, `fcdaCount` | getter, sometimes marked `@state` | Read from the live element during `render()`. `@state` on an existing getter does not track dependencies. Lit keeps the getter and does not turn it into a `$derived`. |
| `filterValues` in `oscd-publisher.ts` | plain object | Remembered search text per publisher type. Not reactive. Read when the editor is created again. |
| `@query` / `@queryAll` | decorator | DOM lookup after render, like `bind:this`. Not state. |

`editCount` is the invalidation signal. Mutating the XML does not notify Lit. The counter has to be passed down (`PublisherPlugin` → editor → element editor) so each child renders again and re-reads the document.

In-place changes to an object or array do not count as a change. Lit compares with `!==`. The copy dialog mutates `option.selected` and then calls `this.requestUpdate()`.

`updated(changedProperties)` runs after the DOM commit. `DataSetEditor` uses it to copy `searchValue` onto the `action-list`. That is the lifecycle hook that corresponds to `$effect`.

## Lit and Svelte runes

| | oscd-publisher (Lit) | Svelte 5 rune (not used here) |
|---|---|---|
| Input from the host | `@property` `doc`, `editCount` | `$props()` |
| UI state | `@state`. Assignment schedules a render. | `$state`. Assignment schedules a render. |
| Derived values | Getter called from `render()`. Runs on every render of that element. No dependency graph. | `$derived` / `$derived.by`. Re-runs when a rune it read has changed. |
| "The XML changed" | Pass `editCount` down as a property. | A `$derived.by` must read `editCount`. The `doc` reference stays the same, so the derived value would otherwise keep the old list. |
| React to a new value | `updated(changedProperties)` | `$effect` |
| Change a field on an existing object | Reference compare, so call `requestUpdate()`. | `$state` proxies plain objects and arrays, so a field write is enough. |
| DOM reference | `@query` | `bind:this` |
| What updates in the DOM | The whole `render()`, then a lit-html diff. | The template spots that read the rune that changed. |

`@state` and `$state` both react to assignment. `$derived` records which runes the expression read. A Lit getter records nothing.

## Selection

The mapper stores ids (`selectedIedName`) and derives the element. The publisher stores the `Element` itself in `@state` (`selectedDataSet`). Attribute edits on that same node keep the selection valid. An edit that replaces the node leaves the field pointing at a detached node. The refresh for that case is the commented `updateElementReference` block in `data-set-editor.ts`.
