/**
 * FastTree service (STUB).
 *
 * This module is a placeholder for the FastTree tree-calculation pipeline.
 * The real implementation will run the `fasttree` biowasm tool (NJ or
 * approximate Maximum Likelihood mode) and return the resulting Newick string.
 *
 * For now it only exposes an empty function that resolves to a placeholder
 * Newick string. The signature is intentionally shaped like the final API so
 * callers can be wired up before the real engine lands.
 */

export type FastTreeMode = "nj" | "ml";

export interface FastTreeOptions {
  /** Calculation mode: neighbor-joining (no ML) or approximate ML. */
  mode: FastTreeMode;
  /** Number of bootstrap replicates (ML mode only). */
  bootstraps?: number;
}

/**
 * Calculates a phylogenetic tree from aligned FASTA sequences using FastTree.
 *
 * @param fasta - Pre-aligned FASTA sequence content.
 * @param options - FastTree calculation options.
 * @returns A promise resolving to the tree in Newick format.
 */
export function calculateTree(
  fasta: string,
  options: FastTreeOptions
): Promise<string> {
  // TODO: Implement FastTree calculation via biowasm.
  void fasta;
  void options;
  return Promise.resolve("(stub);");
}
