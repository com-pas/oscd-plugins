# IEC 61850 NSDoc and NSD

IEC ships the 61850 data model as a pair of code components.

| File | Role |
|------|------|
| **NSD** (namespace definition) | The model: logical-node classes, data objects, common data classes, basic types, enumerations, presence conditions (`M`, `O`, `MOrootLD`, …), and which functional constraints may sit in a GOOSE, Report, or Sampled Value dataset. |
| **NSDoc** | The sentences for that model. Every `titleID` and `descID` in the NSD is a key. The matching `.nsdoc` file holds the text (`Beh` → “Behaviour”, and a paragraph for the class). |

This repo vendors the **NSD only**, through `@openenergytools/scl-lib`. There is no `.nsdoc` file here, so the UI cannot show those standard descriptions unless some other plugin loads them.

The XML is an IEC code component. The copyright notice is inside `nsds.js`. Do not copy it into our sources.

## Where it lives

Under `node_modules/@openenergytools/scl-lib/dist/foundation/`:

| File | Size | What it is |
|------|------|------------|
| `codecomponents/nsds.js` | 1.1 MB | Five NSD documents as template strings: `nsd72`, `nsd73`, `nsd74`, `nsd7420`, `nsd81` (IEC 61850-7-2, 7-3, 7-4, 7-420, 8-1, release 2007B5). |
| `nsd.json` | 3.47 MB | Flat lookup built from that model: **1469** data objects, **49** CDCs. |
| `codecomponents/nsds.d.ts` | 1.2 MB | The same strings again, for TypeScript. Dev only. Not in the browser bundle. |

Counts inside the XML: 215 logical-node classes, 2283 data objects, 70 CDC definitions, 134 enumerations, 950 abbreviations, 13 functional constraints.

## What one entry looks like

NSD keeps the shape once and points at it. `LLN0` in part 7-4:

```xml
<DataObject name="Beh" type="ENS" underlyingType="BehaviourModeKind"
            descID="IEC61850_7_4.LNGroupL::LLN0.Beh.desc"
            presCond="M" dsPresCond="na"/>
```

`type="ENS"` is the common data class from part 7-3. `presCond="M"` means mandatory. `descID` is only a key into an NSDoc file we do not ship.

`nsd.json` is the opposite layout. The CDC attribute tree is copied under every data object that uses it:

```json
"Beh": {
  "cdc": "ENS",
  "children": {
    "stVal": { "bType": "Enum" },
    "q": { "bType": "Quality" },
    "t": { "bType": "Timestamp" }
  }
}
```

That copy is why 1.1 MB of XML becomes 3.47 MB of JSON. The names `children` and `bType` repeat for every attribute of every data object.

## Who reads it

Two functions in scl-lib. This plugin calls neither of them.

**Check a subscription.** `subscribe()` → `doesFcdaMeetExtRefRestrictions()` → `extRefTypeRestrictions()`. The last one fetches `nsd.json` at load (`tExtRef/extRefTypeRestrictions.js`) and resolves `pDO` / `pDA` on an `ExtRef` to a CDC and a basic type. The binding is rejected when they do not match the FCDA. Edition-1 / Edition-2 pairs are allowed (`ENS`/`INS`, `ENC`/`INC`, `Enum`/`INT32`).

**Build a logical node from the standard class.** `insertSelectedLNodeType()` → `nsdToJson()`, which parses the five XML strings in `nsds.js`. That produces the data objects of a class and which of them are mandatory.

The publisher only calls `unsubscribe()`, and only when a dataset or control block is deleted (`removeDataSet`, `removeFCDA`, `removeControlBlock`). That path does not open the NSD.

## What this plugin reads instead

The signal picker (`src/editors/dataset/dataObjectPicker.ts`, `dataAttributePicker.ts`) walks `DataTypeTemplates` of the open SCL file: the `DO`, `SDO`, `DA`, and `BDA` that this IED actually has. A label comes from the element’s `desc`, or from the `Val` of a `DAI` named `d`.

`isFCDACompatibleWithIED` in `src/foundation/utils/xml.ts` does the same kind of walk to decide whether a copied FCDA exists on another IED. Same inputs: `ldInst`, `lnClass`, `prefix`, `lnInst`, `doName`, `daName`, then the project’s type templates.

## Why `index.js` is still ~6.4 MB

`scl-lib`’s package entry re-exports `subscribe` and `nsdToJson`. The package does not set `"sideEffects": false`, and `extRefTypeRestrictions.js` has a top-level `await fetch(...)`. Vite therefore keeps both files in `dist/apps/oscd-publisher/index.js`.

`nsd.json` is inlined as `data:application/json;base64,…`. Base64 adds about a third, so the 3.47 MB table costs ~4.6 MB on top of ~2 MB of JavaScript. The official Rollup build emits `assets/nsd-*.json` beside the script and stays near 2.1 MB plus a separate 3.5 MB fetch.

Build settings that exist only because of this file (`es2022` target, `optimizeDeps.exclude`, the fetch mock in `src/vitest.setup.ts`, `assetsInlineLimit`) are listed in [DEVELOPMENT_VITE-LIT.md](DEVELOPMENT_VITE-LIT.md).
