# Publisher

Publisher edits the parts of an IEC 61850 SCL file that describe how an IED sends data: Data Sets, Reports, GOOSE, and Sampled Values. It runs inside OpenSCD and CoMPAS. Open a station file, then use the Publisher pages to add, change, or remove those objects.

## Pages

The bar at the top has four pages. It opens on Data Sets.

| Page | What it lists |
| --- | --- |
| Data Sets | Named groups of data points (FCDA) an IED can publish |
| Reports | Report controls that send those data sets to a client |
| GOOSE | GOOSE controls for fast peer-to-peer messages |
| Sampled Values | Sampled-value controls, including a new control and its SMV address |

Each page is a list on the left. Open a row to see the connected Data Set on the right.

## Lists

Rows are grouped under the IED name. A group shows a count and can be expanded or collapsed. On a large file, more than 100 rows, every group starts closed so the page stays responsive.

The list shows the values that used to sit in a side editor: name, connected Data Set, revision, and the fields that belong to that page. A missing value is a dash. Search filters the list after a short pause while typing.

## Create and edit

Plus does not write the file immediately. It opens one dialog. Add writes the new object. Cancel drops the draft. The pencil on a row opens the same dialog for an existing object. Save writes the change.

If the IED has more than one LDevice, plus first asks which LDevice receives the new GOOSE, Report, or Sampled Value.

Enter presses the enabled Add or Save button. A click on the page does not close the dialog, so an unfinished edit stays open.

A closed lock means the SCL attribute is absent. Opening the lock writes a value. Closing it removes the attribute again.

## Data Sets

Entries can be reordered by dragging a row. Add data object and Add data attribute append entries, up to the Data Set maximum.

Connect on a control row sets its Data Set at once. Unlink clears that link. The Data Set itself stays. If another IED already subscribes to the control, unlink and Change data set stay disabled. The tooltip says why.

## When an action is blocked

A grey plus does not open the dialog. The tooltip gives the first matching reason: missing structure, a missing Services setting, or a full maximum. Disabled rows in the LDevice list use the same pattern.

## Further reading

- [Changelog](./CHANGELOG.md) records what changed compared with the previous Publisher.
- [Development](../../DEVELOPMENT.md) explains how to run and build plugins in this repository.

## Notice

This plugin is a fork of [oscd-publisher](https://github.com/openenergytools/oscd-publisher). Copyright Jakob Vogelsang and contributors. See [NOTICE](NOTICE).
