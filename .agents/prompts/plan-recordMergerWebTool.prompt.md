## Plan: Record Merger Web Tool (Biowasm + JBrowse2)

Implement the `record-merger` web tool (`@rivm-loculus-tools/record-merger` and `@rivm-loculus-tools/record-merger-demo`) modeled after the architecture of [packages/apps/phylogeny-viewer](packages/apps/phylogeny-viewer). The application loads multiple FASTA files, optional TSV metadata, and a reference genome (via URL query parameters or manual import), provides an interactive record selection table, executes a client-side Biowasm (`@biowasm/aioli` v3) pipeline (`minimap2` alignment → `samtools` BAM sorting/indexing → `samtools consensus` calling on selected input records only, excluding the reference from the consensus), and presents the results in a review view featuring an embedded JBrowse2 Linear Genome View (`@jbrowse/react-linear-genome-view2`) alongside a selected records and metadata summary.

**Steps**

### Phase 1: Common Frontend Extensions (URL & Multi-FASTA Support)
1. Extend `UrlParams` in [packages/common/frontend/src/models/url.models.ts](packages/common/frontend/src/models/url.models.ts) and `UrlService.getParamsFromUrl` in [packages/common/frontend/src/classes/services/UrlService/UrlService.ts](packages/common/frontend/src/classes/services/UrlService/UrlService.ts#L30-L72) to parse `input-reference` (`inputReferenceUrl?: string`) and support multiple `input-fasta` query parameters (`inputFastaUrls?: string[]`, while preserving `inputFastaUrl` for backwards compatibility).
2. Add `FastaUtil.mergeFastas(fastaContents: string[]): string` in [packages/common/frontend/src/utils/FastaUtil/FastaUtil.ts](packages/common/frontend/src/utils/FastaUtil/FastaUtil.ts) to concatenate multiple FASTA inputs cleanly and validate headers.

### Phase 2: Package Scaffolding (`record-merger/frontend` & `record-merger/frontend-demo`)
3. *Depends on Phase 1* — Create `packages/apps/record-merger/frontend` (`package.json`, `tsconfig.json`, `tsconfig.build.json`, `eslint.config.js`, `vite.config.ts`, and `scripts/update-exports.js`) following [packages/apps/phylogeny-viewer/frontend/package.json](packages/apps/phylogeny-viewer/frontend/package.json). Include `@biowasm/aioli` (`3.2.4`), `@jbrowse/react-linear-genome-view2`, `zustand`, `tsyringe`, and peer dependencies matching the monorepo.
4. *Parallel with Step 3* — Create `packages/apps/record-merger/frontend-demo` (`package.json`, `tsconfig.json`, `eslint.config.js`, `vite.config.ts` on port `5040`, `index.html`, `public/sample-data/` with reference FASTA, multi-record FASTA, and metadata TSV, and `src/main.tsx` mounting `RecordMergerDemoApp`).
5. Update root [package.json](package.json#L13-L16) to add `start-merger` (`pnpm --filter @rivm-loculus-tools/record-merger-demo start`) and include `@rivm-loculus-tools/record-merger-demo` in the root `start` script.

### Phase 3: Models, State Store, and Biowasm Pipeline Service
6. *Depends on Step 3* — Define domain models in `packages/apps/record-merger/frontend/src/models/`:
   - `config.models.ts`: `RecordMergerConfig` extending `ConfigBase` from [packages/common/frontend/src/models/config.models.ts](packages/common/frontend/src/models/config.models.ts) with `aioli?: { cdnUrl?: string; minimap2Tool?: string; samtoolsTool?: string }` and `fastaImportExtraActions?: DialogAction[]`.
   - `pipeline.models.ts`: `PIPELINE_STATUS` (`IDLE`, `ALIGNING`, `SORTING_INDEXING`, `CALLING_CONSENSUS`, `SUCCESS`, `ERROR`), `Minimap2Preset` (`map-ont`, `sr`, `asm5`, `asm10`, `asm20`), `ConsensusParams`, and `PipelineResult` (`bamBlobUrl`, `baiBlobUrl`, `referenceFastaBlobUrl`, `referenceFaiBlobUrl`, `consensusFasta`, `consensusSequence`, `selectedIds`).
7. *Depends on Step 6* — Implement `RecordMergerAioliService` in `packages/apps/record-merger/frontend/src/classes/services/RecordMergerAioliService/RecordMergerAioliService.ts` (following the pattern in [AioliServiceAbstract.ts](packages/apps/phylogeny-viewer/frontend/src/classes/abstracts/AioliServiceAbstract/AioliServiceAbstract.ts), initialized with `['minimap2/2.22', 'samtools/1.21']` from Biowasm CDN v3):
   - Mount `reference.fasta` and `selected_inputs.fasta` (containing **only** the user-selected FASTA records, never the reference sequence).
   - Run `samtools faidx reference.fasta` to produce `reference.fasta.fai` for JBrowse2.
   - Run `minimap2 -a -x <preset> reference.fasta selected_inputs.fasta -o aligned.sam` to align selected records against the reference.
   - Run `samtools view -bS aligned.sam -o aligned.bam`, `samtools sort aligned.bam -o aligned.sorted.bam`, and `samtools index aligned.sorted.bam` to generate the sorted BAM and `.bai` index.
   - Run `samtools consensus -f fasta aligned.sorted.bam -o consensus.fasta` to call the consensus strictly from the aligned input records.
   - Export `aligned.sorted.bam`, `aligned.sorted.bam.bai`, `reference.fasta`, and `reference.fasta.fai` via `aioli.downloadBlob(...)` into browser Object URLs (revoking previous URLs on re-run/reset) and extract the called consensus FASTA.
8. *Depends on Steps 6 & 7* — Implement `recordMergerStore` in `packages/apps/record-merger/frontend/src/stores/recordMergerStore/recordMergerStore.ts` composing `createFastaDataStoreActions` from [fastaDataStore.ts](packages/common/frontend/src/stores/fastaDataStore/fastaDataStore.ts):
   - State for `rawReferenceFasta`, `parsedReferenceFasta`, `selectedSequenceIds: string[]`, `searchQuery: string`, `activeStep: 'SELECT' | 'REVIEW'`, `pipelineStatus: PIPELINE_STATUS`, `pipelineError: string | null`, `pipelineParams`, and `pipelineResult: PipelineResult | null`.
   - Actions to load inputs (`setMergerData(fastas, referenceFasta, metadata?)`), toggle/select-all record IDs, filter by search/metadata, execute `runPipeline()` via `RecordMergerAioliService`, and clean up Blob URLs on reset.

### Phase 4: Data Import & Multi-FASTA + Reference Loader (Step 1 of Workflow)
9. *Depends on Phase 3* — Create `RecordMergerImportDialog` and `RecordMergerImportDialogLoader` in `packages/apps/record-merger/frontend/src/components/ui/RecordMergerImportDialog/` modeled after [FastaDataImportDialog.tsx](packages/common/frontend/src/components/fasta/FastaDataImportDialog/FastaDataImportDialog.tsx) and [FastaDataImportDialogLoader.tsx](packages/common/frontend/src/components/fasta/FastaDataImportDialogLoader/FastaDataImportDialogLoader.tsx):
   - Three import sections:
     1. **Input FASTA Sequences** (supports dropping/selecting **multiple** FASTA files, fetching URL(s), or pasting).
     2. **Reference Sequence** (required single FASTA sequence via Drop, URL, or Paste).
     3. **Accompanying Metadata** (optional TSV via Drop, URL, or Paste).
   - Automatic deep-link loader reading `input-fasta` (one or more), `input-reference`, and `input-metadata` via `UrlService`, opening the import dialog if required parameters (`input-fasta` or `input-reference`) are missing or fail to load.

### Phase 5: Interactive Record Selection & Pipeline Execution UI (Steps 2 & 3 of Workflow)
10. *Depends on Phase 3* — Build `RecordSelectionView` in `packages/apps/record-merger/frontend/src/components/ui/RecordSelectionView/`:
    - Interactive MUI table listing all imported FASTA records with selection checkboxes (individual, select all filtered, clear), sequence ID, length, and matched TSV metadata columns (resolved via `MetaDataUtil.getRecordForSample` in [MetaDataUtil.ts](packages/common/frontend/src/utils/MetaDataUtil/MetaDataUtil.ts#L152-L202)).
    - Search bar and metadata filter helper to quickly filter/select related sequences to merge.
    - Reference sequence summary banner showing the loaded reference ID and length, plus a primary **"Merge & Run Pipeline (N selected)"** button.
11. *Parallel with Step 10* — Build `RecordMergerPageDrawer` and `RecordMergerPageHeader` in `packages/apps/record-merger/frontend/src/components/ui/` following [PhylogenyViewerPageDrawer.tsx](packages/apps/phylogeny-viewer/frontend/src/components/ui/PhylogenyViewerPageDrawer/PhylogenyViewerPageDrawer.tsx) and [PhylogenyViewerPageHeader.tsx](packages/apps/phylogeny-viewer/frontend/src/components/ui/PhylogenyViewerPageHeader/PhylogenyViewerPageHeader.tsx):
    - Drawer with pipeline configuration (`minimap2` preset, `samtools consensus` options, metadata match key selector) and "Load / Replace Data" button.
    - Header with dataset counters, step switcher ("1. Select Records" / "2. Review Merge"), Export menu (Download Consensus FASTA, Download Sorted BAM), and Reset button.

### Phase 6: Results Verification & JBrowse2 Visualization (Step 4 of Workflow)
12. *Depends on Steps 7 & 8* — Build `JBrowseAlignmentView` in `packages/apps/record-merger/frontend/src/components/ui/JBrowseAlignmentView/`:
    - Uses `@jbrowse/react-linear-genome-view2` (`createViewState` + `JBrowseLinearGenomeView`).
    - Configures the reference assembly using `IndexedFastaAdapter` backed by the `reference.fasta` and `reference.fasta.fai` Blob URLs.
    - Configures an `AlignmentsTrack` (`BamAdapter`) backed by the `aligned.sorted.bam` and `aligned.sorted.bam.bai` Blob URLs, displayed by default across the reference sequence.
13. *Parallel with Step 12* — Build `MergeReviewView` in `packages/apps/record-merger/frontend/src/components/ui/MergeReviewView/`:
    - Displays the **Selected Records & Metadata Summary** panel showing the combined source records, their metadata fields, and the resulting consensus sequence preview.
    - Embeds `JBrowseAlignmentView` so the user can visually inspect the read/sequence alignments and pileup against the reference.
    - Provides a "Back to Selection" button to modify the record selection and re-run the pipeline.

### Phase 7: Page Composition, Exports, and Validation
14. *Depends on Phases 4–6* — Assemble `RecordMergerPageMainPage` (with `BackdropSpinner` displaying the active pipeline stage: aligning, sorting/indexing, or calling consensus), `RecordMergerApp`, `RecordMergerStandardConfigUtil`, and `RecordMergerDemoApp`.
15. Run `pnpm --filter @rivm-loculus-tools/common-frontend update-exports` and `pnpm --filter @rivm-loculus-tools/record-merger update-exports` to generate package export maps via [scripts/update-exports.mjs](scripts/update-exports.mjs).
16. Run `pnpm validate` (`lint` and `check-types`) and `pnpm build` across `common-frontend`, `record-merger`, and `record-merger-demo`.

**Relevant files**
- [packages/common/frontend/src/models/url.models.ts](packages/common/frontend/src/models/url.models.ts) — Add `inputReferenceUrl` and `inputFastaUrls` to `UrlParams`
- [packages/common/frontend/src/classes/services/UrlService/UrlService.ts](packages/common/frontend/src/classes/services/UrlService/UrlService.ts) — Parse `input-reference` and multiple `input-fasta` query parameters
- [packages/common/frontend/src/utils/FastaUtil/FastaUtil.ts](packages/common/frontend/src/utils/FastaUtil/FastaUtil.ts) — Add `FastaUtil.mergeFastas` for combining multiple FASTA imports
- [packages/apps/phylogeny-viewer/frontend/src/classes/abstracts/AioliServiceAbstract/AioliServiceAbstract.ts](packages/apps/phylogeny-viewer/frontend/src/classes/abstracts/AioliServiceAbstract/AioliServiceAbstract.ts) — Reference pattern for Biowasm `@biowasm/aioli` service wrapper
- [packages/common/frontend/src/components/fasta/FastaDataImportDialog/FastaDataImportDialog.tsx](packages/common/frontend/src/components/fasta/FastaDataImportDialog/FastaDataImportDialog.tsx) — Reference pattern for `withDialog` multi-tab (Drop/URL/Paste) import dialog
- [packages/common/frontend/src/stores/fastaDataStore/fastaDataStore.ts](packages/common/frontend/src/stores/fastaDataStore/fastaDataStore.ts) — Base Zustand store state and actions (`createFastaDataStoreActions`) to compose into `recordMergerStore`
- [packages/apps/phylogeny-viewer/frontend/package.json](packages/apps/phylogeny-viewer/frontend/package.json) & [packages/apps/phylogeny-viewer/frontend-demo/package.json](packages/apps/phylogeny-viewer/frontend-demo/package.json) — Templates for `record-merger` library and demo manifests

**Verification**
1. Run `pnpm --filter @rivm-loculus-tools/common-frontend validate` to verify `UrlService` and `FastaUtil` updates pass ESLint and TypeScript checks.
2. Run `pnpm --filter @rivm-loculus-tools/record-merger update-exports && pnpm --filter @rivm-loculus-tools/record-merger validate` to verify export maps, `@gen-epix/eslint-config` rules, and strict TypeScript types pass with zero warnings.
3. Run `pnpm --filter @rivm-loculus-tools/record-merger-demo validate && pnpm --filter @rivm-loculus-tools/record-merger-demo build` to verify the standalone demo builds cleanly with JBrowse2 and Biowasm dependencies.
4. Manual verification via `pnpm start-merger`:
   - Load data via the "Demo Data" button, manual multi-FASTA + Reference + Metadata upload, and URL query parameters (`?input-fasta=...&input-reference=...&input-metadata=...`).
   - Select a subset of records in the selection table, click "Merge & Run Pipeline", and verify that `minimap2`, `samtools view/sort/index/faidx`, and `samtools consensus` execute in the Biowasm WebWorker using only the selected input records for consensus calling.
   - Verify the Review screen renders the JBrowse2 Linear Genome View with the reference assembly and BAM alignment track alongside the selected records and metadata summary table.

**Decisions**
- **Reference Input**: Supplied via `input-reference` URL query parameter or a dedicated Reference section (Drop/URL/Paste) in the import dialog. Used strictly as the alignment target and JBrowse2 reference assembly, never included in the consensus reads.
- **Consensus Caller**: Uses `samtools consensus` (`samtools/1.21` from Biowasm CDN v3) directly on the sorted BAM of selected input sequences.
- **Selection Workflow**: Interactive table allowing the user to filter and select a subset of imported FASTA records to merge into a single consensus sequence per run.
- **Review View & Scope**: Displays the JBrowse2 Linear Genome View (Reference + BAM alignment track) and the Selected Records & Metadata Summary. Uploading back to Loculus is deferred to a later stage.
