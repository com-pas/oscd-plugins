# CoMPAS OpenSCD plugins

[CoMPAS](https://lfenergy.org/projects/compas/) is the LF Energy project for configuration of protection, automation, and control systems. Its editor is OpenSCD. Plugins extend that editor. CoMPAS loads each plugin as one `index.js` from a URL.

This repository holds those plugins.

## Plugins

| Plugin | Changelog | Snapshot | Description |
| --- | --- | --- | --- |
| [Publisher](apps/oscd-publisher/README.md) | [Changelog](apps/oscd-publisher/CHANGELOG.md) | [index.js](https://com-pas.github.io/oscd-plugins/compas/plugins/oscd-publisher/snapshot/index.js) | Publisher edits Data Sets, Reports, GOOSE, and Sampled Values in an SCL file. |

## Further reading

- [Development](DEVELOPMENT.md) is for people who build or change a plugin.
- [CoMPAS](https://lfenergy.org/projects/compas/) is the LF Energy project that loads these plugins into its OpenSCD editor.
- [Demo OpenSCD](https://openscd.github.io/) is a public OpenSCD where you can open an SCL file and try a plugin.
