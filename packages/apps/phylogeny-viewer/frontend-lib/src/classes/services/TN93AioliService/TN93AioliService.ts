import { HmrUtil } from '@gen-epix/ui-core/utils/HmrUtil';
import { RapidNeighborJoining } from 'neighbor-joining';
import { FastaUtil } from '@rivm-loculus-tools/common-frontend/utils/FastaUtil';

import type { AioliService } from '../../abstracts/AioliServiceAbstract';
import { AioliServiceAbstract } from '../../abstracts/AioliServiceAbstract';

type DistanceEntry = {
  distance: number;
  seq1: string;
  seq2: string;
};

export class TN93AioliService extends AioliServiceAbstract implements AioliService {
  private static __instance: TN93AioliService;

  private constructor() {
    super('tn93/1.0.11');
  }

  public static getInstance(): TN93AioliService {
    TN93AioliService.__instance = HmrUtil.getHmrSingleton('tn93AioliService', TN93AioliService.__instance, () => new TN93AioliService());
    return TN93AioliService.__instance;
  }

  private static buildDistanceMatrix(entries: DistanceEntry[]): { matrix: number[][]; taxa: string[] } {
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

    const matrix = Array.from({ length: n }, () => Array<number>(n).fill(0));

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

  private static parseTN93CSV(output: string): DistanceEntry[] {
    const entries: DistanceEntry[] = [];
    const lines = output.trim().split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      // TN93 CSV default: seqname1,seqname2,distance or seqname1, seqname2, distance
      const parts = trimmed.split(',');
      if (parts.length >= 3) {
        const seq1 = parts[0].trim();
        const seq2 = parts[1].trim();
        const distance = parseFloat(parts[2].trim());

        if (!isNaN(distance)) {
          entries.push({ distance, seq1, seq2 });
        }
      }
    }

    return entries;
  }

  public async getTree(fastaContent: string): Promise<string> {
    const tTotalStart = performance.now();
    console.info('[TN93] Starting tree calculation...');

    const strippedFasta = FastaUtil.stripFastaHeaders(fastaContent);
    const file = new File([strippedFasta], 'input.fasta', { type: 'text/plain' });
    await this.mount(file);

    const tRun = performance.now();
    const result = await this.exec('tn93', ['-t', '1.0', '-q', 'input.fasta']);
    console.info(`[TN93] Distance matrix computation: ${(performance.now() - tRun).toFixed(0)}ms`);
    console.info('[TN93] Full Raw Output:\n', result);

    const entries = TN93AioliService.parseTN93CSV(result);
    if (entries.length === 0) {
      throw new Error('TN93 produced no valid distance entries. Check that the input FASTA contains aligned sequences.');
    }

    const { matrix, taxa } = TN93AioliService.buildDistanceMatrix(entries);
    console.info(`[TN93] Built matrix with ${taxa.length} taxa`);

    const tNJ = performance.now();
    const nj = new RapidNeighborJoining(matrix, taxa, false, (taxon: string) => taxon);
    nj.run();
    const newick = nj.getAsNewick();
    console.info('[TN93] Generated Newick Tree:\n', newick);
    console.info(`[TN93] NJ conversion: ${(performance.now() - tNJ).toFixed(0)}ms (Total: ${(performance.now() - tTotalStart).toFixed(0)}ms)`);

    return newick;
  }
}
