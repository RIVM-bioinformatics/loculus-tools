/**
 * TN93 tree service (STUB).
 *
 * This module is a placeholder for the TN93 + Neighbor-Joining tree
 * calculation pipeline. The real implementation will:
 *   1. Run the `tn93` biowasm tool to compute a pairwise distance matrix.
 *   2. Convert the distance matrix to a Newick string using a
 *      neighbor-joining module.
 *
 * For now it only exposes an empty function that resolves to a placeholder
 * Newick string. The signature is intentionally shaped like the final API so
 * callers can be wired up before the real engine lands.
 */

/**
 * Calculates a phylogenetic tree from aligned FASTA sequences using the
 * TN93 distance + Neighbor-Joining method.
 *
 * @param fasta - Pre-aligned FASTA sequence content.
 * @returns A promise resolving to the tree in Newick format.
 */
export function calculateTree(fasta: string): Promise<string> {
  // TODO: Implement TN93 + Neighbor-Joining calculation via biowasm.
  void fasta;
  return Promise.resolve("(stub);");
}
