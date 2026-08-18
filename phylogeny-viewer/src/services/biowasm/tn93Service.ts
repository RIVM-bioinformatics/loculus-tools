import * as NJModule from 'neighbor-joining';
import { preloaderService } from './preloaderService';

const RapidNeighborJoining = (NJModule as any).RapidNeighborJoining || (NJModule as any).default?.RapidNeighborJoining || (NJModule as any).default;

interface DistanceEntry {
  seq1: string;
  seq2: string;
  distance: number;
}

function parseTN93CSV(output: string): DistanceEntry[] {
  const entries: DistanceEntry[] = [];
  const lines = output.trim().split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // TN93 CSV default: seqname1,seqname2,distance or seqname1, seqname2, distance
    const parts = trimmed.split(',');
    if (parts.length >= 3) {
      const seq1 = parts[0].trim();
      const seq2 = parts[1].trim();
      const distance = parseFloat(parts[2].trim());

      if (!isNaN(distance)) {
        entries.push({ seq1, seq2, distance });
      }
    }
  }

  return entries;
}

function buildDistanceMatrix(entries: DistanceEntry[]): { matrix: number[][]; taxa: string[] } {
  const taxaSet = new Set<string>();
  for (const entry of entries) {
    taxaSet.add(entry.seq1);
    taxaSet.add(entry.seq2);
  }
  const taxa = Array.from(taxaSet);
  const n = taxa.length;

  const indexMap = new Map<string, number>();
  taxa.forEach((taxon, i) => {
    indexMap.set(taxon, i);
  });

  const matrix: number[][] = new Array(n);
  for (let i = 0; i < n; i++) {
    matrix[i] = new Array(n).fill(0);
  }

  for (const entry of entries) {
    const i = indexMap.get(entry.seq1);
    const j = indexMap.get(entry.seq2);
    if (i !== undefined && j !== undefined) {
      matrix[i][j] = entry.distance;
      matrix[j][i] = entry.distance; // symmetric
    }
  }

  return { matrix, taxa };
}

export function stripFastaHeaders(fastaContent: string): string {
  const lines = fastaContent.split('\n');
  const strippedLines = lines.map((line) => {
    if (line.startsWith('>')) {
      const cleanHeader = line.substring(1).trim();
      const firstPart = cleanHeader.split(/[|\t]/)[0].trim();
      const safeId = firstPart.replace(/[():;,']/g, '_');
      return `>${safeId}`;
    }
    return line;
  });
  return strippedLines.join('\n');
}

export async function calculateTN93Tree(fastaContent: string): Promise<string> {
  const tTotalStart = performance.now();
  console.log('[TN93] Starting tree calculation...');

  // Step 1: Strip headers & mount
  const strippedFasta = stripFastaHeaders(fastaContent);
  const tn93 = await preloaderService.getTN93Instance();
  const file = new File([strippedFasta], 'input.fasta', { type: 'text/plain' });
  await tn93.mount(file);

  // Step 2: Run TN93 distance calculation
  const tRun = performance.now();
  const result = await tn93.exec('tn93', ['-t', '1.0', '-q', 'input.fasta']);
  console.log(`[TN93] Distance matrix computation: ${(performance.now() - tRun).toFixed(0)}ms`);
  console.log('[TN93] Full Raw Output:\n', result);

  // Step 3: Parse CSV output
  const entries = parseTN93CSV(result);
  if (entries.length === 0) {
    throw new Error('TN93 produced no valid distance entries. Check that the input FASTA contains aligned sequences.');
  }

  // Step 4: Build distance matrix
  const { matrix, taxa } = buildDistanceMatrix(entries);
  console.log(`[TN93] Built matrix with ${taxa.length} taxa`);

  // Step 5: Neighbor-joining
  const tNJ = performance.now();
  const nj = new RapidNeighborJoining(matrix, taxa, false, (taxon: string) => taxon);
  nj.run();
  const newick = nj.getAsNewick();
  console.log('[TN93] Generated Newick Tree:\n', newick);
  console.log(`[TN93] NJ conversion: ${(performance.now() - tNJ).toFixed(0)}ms (Total: ${(performance.now() - tTotalStart).toFixed(0)}ms)`);

  return newick;
}
