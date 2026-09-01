import type {
  FastTreeMLParams,
  FastTreeMode,
} from '../models/calculation';

import { preloaderService } from './biowasm/PreloaderService';
import { stripFastaHeaders } from './biowasm/Tn93Service';

export const extractNewickTree = (output: string): string => {
  const lastSemi = output.lastIndexOf(';');
  if (lastSemi === -1) {
    throw new Error('No terminating semicolon (;) found in tree output.');
  }

  let depth = 0;
  let rootParen = -1;

  for (let i = lastSemi; i >= 0; i--) {
    const char = output[i];
    if (char === ';') {
      depth = 0;
    } else if (char === ')') {
      depth++;
    } else if (char === '(') {
      if (depth === 1) {
        rootParen = i;
        break;
      }
      depth--;
    }
  }

  if (rootParen !== -1 && rootParen < lastSemi) {
    return output.substring(rootParen, lastSemi + 1).replace(/[\r\n\t]+/g, '').trim();
  }

  const firstParen = output.indexOf('(');
  if (firstParen !== -1 && firstParen < lastSemi) {
    return output.substring(firstParen, lastSemi + 1).replace(/[\r\n\t]+/g, '').trim();
  }

  throw new Error(`Could not extract valid Newick tree from FastTree output:\n${output.substring(0, 500)}`);
};

export const calculateFastTree = async (
  fastaContent: string,
  mode: FastTreeMode = 'noml',
  params?: Partial<FastTreeMLParams>,
): Promise<string> => {
  const tTotalStart = performance.now();
  console.log(`[FastTree] Starting calculation (mode: ${mode})...`);

  // Step 1: Strip headers & mount
  const strippedFasta = stripFastaHeaders(fastaContent);
  const fasttree = await preloaderService.getFastTreeInstance();
  const file = new File([strippedFasta], 'input.fasta', { type: 'text/plain' });
  await fasttree.mount(file);

  // Step 2: Build command arguments
  const args: string[] = ['-nt']; // Nucleotide sequences

  if (mode === 'noml') {
    args.push('-noml', '-fastest');
  } else {
    // Maximum Likelihood mode with optional parameters
    if (params?.model === 'gtr') {
      args.push('-gtr');
    }
    if (params?.gamma) {
      args.push('-gamma');
    }
    if (typeof params?.bootstrapping === 'number' && params.bootstrapping > 0) {
      args.push('-boot', params.bootstrapping.toString());
    }
    if (typeof params?.spr === 'number' && params.spr > 0) {
      args.push('-spr', params.spr.toString());
    }
  }

  args.push('input.fasta');

  // Step 3: Execute FastTree
  const tExec = performance.now();
  const result = await fasttree.exec('fasttree', args);
  console.log(`[FastTree] Execution: ${(performance.now() - tExec).toFixed(0)}ms`);
  console.log('[FastTree] Full Raw Output:\n', result);

  // Step 4: Extract Newick tree from output
  const newickTree = extractNewickTree(result);
  console.log('[FastTree] Extracted Newick Tree:\n', newickTree);
  console.log(`[FastTree] Finished in ${(performance.now() - tTotalStart).toFixed(0)}ms (Newick length: ${newickTree.length})`);

  return newickTree;
};
