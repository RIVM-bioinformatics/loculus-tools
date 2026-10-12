# Phylogenetic Tree Viewer (`loculus-tools/phylogeny-viewer`)

A client-side interactive phylogenetic tree analysis tool and dedicated loculus-tool designed for rapid investigation and ad-hoc visualization of phylogenetic trees directly in the browser.

## Features

- **Dual-Engine WASM Tree Calculation**:
  - **TN93 + Neighbor-Joining**: Ultra-fast distance matrix computation converted via `RapidNeighborJoining` into Newick format.
  - **FastTree (Biowasm)**: Neighbor-Joining (`-noml -fastest`) and Maximum Likelihood (ML) with customizable evolutionary models (GTR / Jukes-Cantor), bootstrapping iterations, and SPR rounds.
  - **Parallel Dependency Preloader**: Background preloading of `fasttree/2.1.11` and `tn93/1.0.11` via Web Workers (`@biowasm/aioli`).
- **Tree Visualization**:
  - Rendered via `@gen-epix/ui-casedb`'s `PhylogeneticTreeComponent` on high-DPI HTML5 Canvas.
  - Interactive mouse scroll zoom and click-and-drag panning with scale stability.
  - Distance scale bar with dynamic tick increments.
- **Pre-Alignment Sequence Validation**:
  - Validates character length across FASTA headers. If unaligned sequences are provided, calculations are safely aborted and an informative warning modal is presented (`INVALID_ALIGNMENT`).
- **Metadata Enrichment & Color Mapping**:
  - Deterministic palette generation for any TSV metadata attribute.
  - Interactive floating dynamic legend.
  - Composite leaf label builder (`accessionVersion|Field1|Field2`).
- **Interactivity & Inspection**:
  - Real-time free-text search with prominent red outline highlights on matching leaf nodes.
  - Draggable inspection tooltips for leaf sample metadata and internal node clade collapse/expand.
- **Export Formats**:
  - Save as Newick (`.nwk`), PNG image, JPEG image, and SVG vector format.
- **Deep Linking**:
  - Auto-loads datasets on launch using `?input-fasta=<url>` and `?input-metadata=<url>` query parameters.

## Getting Started

This package is part of the `loculus-tools` pnpm monorepo, so dependencies are installed from the **repo root**.

### Development

```bash
pnpm install
pnpm --filter @rivm-loculus-tools/phylogeny-viewer start
```

### Production Build

```bash
pnpm --filter @rivm-loculus-tools/phylogeny-viewer build
pnpm --filter @rivm-loculus-tools/phylogeny-viewer preview
```

### Demo Data

Click **Load Data** -> **Load Demo SARS-CoV-2 Data** in the UI, or load:

- FASTA: `/sample-data/sarscov2_aligned.fasta`
- TSV: `/sample-data/sarscov2_metadata.tsv`
