# Changelog

All notable changes to the **oscd-publisher** application are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [unreleased]

The first release is a fork of the old Publisher from https://github.com/com-pas/oscd-publisher 

### Changed

Main Changes in compare with the original publisher:
The notes below are the user-visible changes in the OpenSCD / CoMPAS publisher, largest first. Copy, remove, and the Add data object / Add data attribute pickers were already in the old version and are left out except where their place in the screen changed.

* A compact layout that keeps more of the SCL on screen
* Create and edit in one dialog
* Sampled Values can be created
* Overviews are grouped by IED and start closed on a large file
* The overview shows the attributes that used to sit in the side editor
* Linking a Data Set, and a lock when another IED subscribes
* Data Set entries are reordered by drag and drop
* Enter saves the open form
* Tooltips explain why an action is blocked
* Overview search waits until typing pauses
* Faster Development - Playground theme bar
* The LDevice chooser also opens for a new GOOSE, Report, or Sampled Value when the IED has more than one LDevice

More Details: [CHANGELOG_1.0.0_Details.md](./CHANGELOG_1.0.0_Details.md)



