# Changelog

## [0.5.0](https://github.com/RIVM-bioinformatics/loculus-tools/compare/sequence-editor-wasm-v0.4.0...sequence-editor-wasm-v0.5.0) (2026-11-11)


### Features

* **engine:** prepend data and delete rows ([#85](https://github.com/RIVM-bioinformatics/loculus-tools/issues/85)) ([363bb26](https://github.com/RIVM-bioinformatics/loculus-tools/commit/363bb2619b23ebe522ea34769afca1746c69a432))

## [0.4.0](https://github.com/RIVM-bioinformatics/loculus-tools/compare/sequence-editor-wasm-v0.3.0...sequence-editor-wasm-v0.4.0) (2026-11-03)


### Features

* **sequence-editor, engine:** add mafft to cargo dependencies ([06d2263](https://github.com/RIVM-bioinformatics/loculus-tools/commit/06d226303bbd57347b924a5aa56f202caf6f8b3c))
* **sequence-editor, engine:** add max output cells limit for MAFFT alignment (preflight check) ([06d2263](https://github.com/RIVM-bioinformatics/loculus-tools/commit/06d226303bbd57347b924a5aa56f202caf6f8b3c))
* **sequence-editor, engine:** add standalone apply_aligned_fasta and align_fasta functions for sequence alignment ([06d2263](https://github.com/RIVM-bioinformatics/loculus-tools/commit/06d226303bbd57347b924a5aa56f202caf6f8b3c))
* **sequence-editor, engine:** implement initialization of secondary AlignmentWorker as part of the EditorWorkerService for analysis and termination ([06d2263](https://github.com/RIVM-bioinformatics/loculus-tools/commit/06d226303bbd57347b924a5aa56f202caf6f8b3c))
* **sequence-editor, engine:** implement MAFFT-based sequence alignment and realignment functionality using `FFT-NS-1` ([06d2263](https://github.com/RIVM-bioinformatics/loculus-tools/commit/06d226303bbd57347b924a5aa56f202caf6f8b3c))
* **sequence-editor, engine:** implement MAFFT-based sequence alignment and realignment functionality using `FFT-NS-1` ([06d2263](https://github.com/RIVM-bioinformatics/loculus-tools/commit/06d226303bbd57347b924a5aa56f202caf6f8b3c))
* **sequence-editor, frontend:** add a secondary worker; AlignerWorker for MAFFT sequence alignment ([06d2263](https://github.com/RIVM-bioinformatics/loculus-tools/commit/06d226303bbd57347b924a5aa56f202caf6f8b3c))
* **sequence-editor, frontend:** add align button to sequence editor page header ([06d2263](https://github.com/RIVM-bioinformatics/loculus-tools/commit/06d226303bbd57347b924a5aa56f202caf6f8b3c))
* **sequence-editor, frontend:** add an 'isRealigning' state to frontend data store ([06d2263](https://github.com/RIVM-bioinformatics/loculus-tools/commit/06d226303bbd57347b924a5aa56f202caf6f8b3c))
* **sequence-editor, frontend:** add realign functionality to EditorWorker and EngineWorker ([06d2263](https://github.com/RIVM-bioinformatics/loculus-tools/commit/06d226303bbd57347b924a5aa56f202caf6f8b3c))
* **sequence-editor, frontend:** add SequenceEditorRealignModal and integrate realignment cancellation ([06d2263](https://github.com/RIVM-bioinformatics/loculus-tools/commit/06d226303bbd57347b924a5aa56f202caf6f8b3c))
* **sequence-editor:** enhance horizontal move actions to support multi-row selectors ([06d2263](https://github.com/RIVM-bioinformatics/loculus-tools/commit/06d226303bbd57347b924a5aa56f202caf6f8b3c)), closes [#31](https://github.com/RIVM-bioinformatics/loculus-tools/issues/31)
* **sequence-editor:** refine horizontal movement logic to handle edge cases and improve selection updates ([06d2263](https://github.com/RIVM-bioinformatics/loculus-tools/commit/06d226303bbd57347b924a5aa56f202caf6f8b3c))


### Bug Fixes

* **dependencies:** specify MAFFT version with default features disabled ([06d2263](https://github.com/RIVM-bioinformatics/loculus-tools/commit/06d226303bbd57347b924a5aa56f202caf6f8b3c))
* **sequence-editor, engine:** accept lowercase residues in apply_aligned_fasta and display errors emitted from realign function ([06d2263](https://github.com/RIVM-bioinformatics/loculus-tools/commit/06d226303bbd57347b924a5aa56f202caf6f8b3c))
* **sequence-editor, frontend:** implement abort handling for realignment process ([06d2263](https://github.com/RIVM-bioinformatics/loculus-tools/commit/06d226303bbd57347b924a5aa56f202caf6f8b3c))
* **sequence-editor, frontend:** improve abort handling in alignment process ([06d2263](https://github.com/RIVM-bioinformatics/loculus-tools/commit/06d226303bbd57347b924a5aa56f202caf6f8b3c))
* **sequence-editor, frontend:** Update aria-label for re-align button to reflect realigning state ([06d2263](https://github.com/RIVM-bioinformatics/loculus-tools/commit/06d226303bbd57347b924a5aa56f202caf6f8b3c))
* **sequence-editor, frontend:** Update tooltip and aria-label for re-align button ([06d2263](https://github.com/RIVM-bioinformatics/loculus-tools/commit/06d226303bbd57347b924a5aa56f202caf6f8b3c))

## [0.3.0](https://github.com/RIVM-bioinformatics/loculus-tools/compare/sequence-editor-wasm-v0.2.0...sequence-editor-wasm-v0.3.0) (2026-10-20)


### Features

* **sequence-editor, engine:** mutate bases in multi-row and multi-column ranges as a single operation ([4c4aa64](https://github.com/RIVM-bioinformatics/loculus-tools/commit/4c4aa64ed0cbf06a78f196645535e9508427a2b2))

## [0.2.0](https://github.com/RIVM-bioinformatics/loculus-tools/compare/sequence-editor-wasm-v0.1.7...sequence-editor-wasm-v0.2.0) (2026-10-17)


### Features

* **sequence-editor, engine:** add dedicated fast export functionality for gapped and ungapped sequences ([#51](https://github.com/RIVM-bioinformatics/loculus-tools/issues/51)) ([2a437e6](https://github.com/RIVM-bioinformatics/loculus-tools/commit/2a437e61da349de5ff27a2fe3ced12e4a52a0d58))

## [0.1.7](https://github.com/RIVM-bioinformatics/loculus-tools/compare/sequence-editor-wasm-v0.1.6...sequence-editor-wasm-v0.1.7) (2026-10-16)


### Bug Fixes

* **sequence-editor, engine:** ensure all search operations are case-insensitive ([4bdd1ef](https://github.com/RIVM-bioinformatics/loculus-tools/commit/4bdd1ef427c4d82be64c8614a3bb39463d9dcd99))

## [0.1.6](https://github.com/RIVM-bioinformatics/loculus-tools/compare/sequence-editor-wasm-v0.1.5...sequence-editor-wasm-v0.1.6) (2026-10-14)


### Bug Fixes

* **sequence-editor,engine:** Accept empty FASTA records on load with zero length ([#9](https://github.com/RIVM-bioinformatics/loculus-tools/issues/9)) ([758a41b](https://github.com/RIVM-bioinformatics/loculus-tools/commit/758a41b385e699427388bf3e820944ded925cbf5))

## [0.1.5](https://github.com/RIVM-bioinformatics/loculus-tools/compare/sequence-editor-wasm-v0.1.4...sequence-editor-wasm-v0.1.5) (2026-10-13)


### Bug Fixes

* **sequence-editor,engine:** preserve full fasta headers on load ([91a32a5](https://github.com/RIVM-bioinformatics/loculus-tools/commit/91a32a53be8a620bea6782da8b6141ce45437b10))

## [0.1.4](https://github.com/RIVM-bioinformatics/loculus-tools/compare/sequence-editor-wasm-v0.1.3...sequence-editor-wasm-v0.1.4) (2026-10-13)


### Bug Fixes

* fix wasm package.json generator git url ([7073a00](https://github.com/RIVM-bioinformatics/loculus-tools/commit/7073a006ae6782ebbd7c9915574db659f3b91feb))

## [0.1.3](https://github.com/RIVM-bioinformatics/loculus-tools/compare/sequence-editor-wasm-v0.1.2...sequence-editor-wasm-v0.1.3) (2026-10-13)


### Bug Fixes

* fix repository URL once more ([2094f8e](https://github.com/RIVM-bioinformatics/loculus-tools/commit/2094f8e27412eebbe2c4308f31a5d5d8341d94c5))

## [0.1.2](https://github.com/RIVM-bioinformatics/loculus-tools/compare/sequence-editor-wasm-v0.1.1...sequence-editor-wasm-v0.1.2) (2026-10-13)


### Bug Fixes

* fix repository URL in package.json files ([b9afa16](https://github.com/RIVM-bioinformatics/loculus-tools/commit/b9afa16b4621a1ded75e908fce0d28b01cf0c8d5))

## [0.1.1](https://github.com/RIVM-bioinformatics/loculus-tools/compare/sequence-editor-wasm-v0.1.0...sequence-editor-wasm-v0.1.1) (2026-10-13)


### Bug Fixes

* trigger release ([36721cc](https://github.com/RIVM-bioinformatics/loculus-tools/commit/36721ccb4cf1541a7f42ae64445fb8304a9c4c57))

## 0.1.0 (2026-10-13)


### Features

* setup release please ([8cb6a5a](https://github.com/RIVM-bioinformatics/loculus-tools/commit/8cb6a5ad5325b37737d95bef2e6892892b7d4043))
