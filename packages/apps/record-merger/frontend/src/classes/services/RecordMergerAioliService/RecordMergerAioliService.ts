import type { AioliInstance } from '@biowasm/aioli';
import Aioli from '@biowasm/aioli';
import { CONFIG_TOKEN } from '@rivm-loculus-tools/common-frontend/constants/config.constants';
import type { FastaSequence } from '@rivm-loculus-tools/common-frontend/models/fasta.models';
import { FastaUtil } from '@rivm-loculus-tools/common-frontend/utils/FastaUtil';
import {
  inject,
  singleton,
} from 'tsyringe';

import type { RecordMergerConfig } from '../../../models/config.models';
import type {
  AlignmentResult,
  ConsensusParams,
  ConsensusResult,
  Minimap2Preset,
} from '../../../models/pipeline.models';
import { PIPELINE_STATUS } from '../../../models/pipeline.models';

export type AlignmentRunOptions = {
  onStageChange?: (stage: PIPELINE_STATUS) => void;
  preset: Minimap2Preset;
  referenceSequence: FastaSequence;
  selectedSequences: FastaSequence[];
};

export type ConsensusRunOptions = {
  alignmentResult: AlignmentResult;
  onStageChange?: (stage: PIPELINE_STATUS) => void;
  params: ConsensusParams;
};

const REFERENCE_FILE = 'reference.fasta';
const REFERENCE_FAI_FILE = 'reference.fasta.fai';
const SELECTED_INPUTS_FILE = 'selected_inputs.fasta';
const ALIGNED_SAM_FILE = 'aligned.sam';
const ALIGNED_BAM_FILE = 'aligned.bam';
const SORTED_BAM_FILE = 'aligned.sorted.bam';
const SORTED_BAI_FILE = 'aligned.sorted.bam.bai';
const CONSENSUS_FASTA_FILE = 'consensus.fasta';

@singleton()
export class RecordMergerAioliService {
  private aioli: AioliInstance | null = null;
  private readonly config: RecordMergerConfig;
  private hasMountedFiles = false;
  private readonly tools: string[];

  public constructor(@inject(CONFIG_TOKEN) config: RecordMergerConfig) {
    this.config = config;
    this.tools = [
      config?.aioli?.minimap2Tool ?? 'minimap2/2.22',
      config?.aioli?.samtoolsTool ?? 'samtools/1.21',
    ];
  }

  private static formatExecOutput(result: unknown): string {
    if (typeof result === 'string') {
      return result.trim();
    }
    if (result && typeof result === 'object') {
      const { stderr, stdout } = result as { stderr?: string; stdout?: string };
      return [stdout, stderr].filter(Boolean).join('\n').trim();
    }
    return '';
  }

  /**
   * Aligns only the selected input FASTA records against the reference genome
   * and produces indexed BAM/reference Blob URLs for inspection in JBrowse2.
   */
  public async runAlignment(options: AlignmentRunOptions): Promise<AlignmentResult> {
    const { onStageChange, preset, referenceSequence, selectedSequences } = options;

    if (selectedSequences.length === 0) {
      throw new Error('Select at least one FASTA record to run alignment.');
    }
    if (!referenceSequence?.sequence) {
      throw new Error('A valid reference FASTA sequence is required.');
    }

    const tStart = performance.now();

    // Reset worker between alignment runs so WORKERFS mounts cleanly without filename collisions.
    if (this.hasMountedFiles && this.aioli) {
      await this.aioli.close();
      this.aioli = null;
      this.hasMountedFiles = false;
    }

    const aioli = await this.init();

    const referenceFastaText = `>${referenceSequence.id}\n${referenceSequence.sequence}\n`;
    // Strictly include only user-selected input records; never include the reference sequence.
    const selectedInputsFastaText = `${selectedSequences
      .map((seq) => `>${seq.id}\n${seq.sequence}`)
      .join('\n')}\n`;

    const referenceFile = new File([referenceFastaText], REFERENCE_FILE, { type: 'text/plain' });
    const selectedInputsFile = new File([selectedInputsFastaText], SELECTED_INPUTS_FILE, { type: 'text/plain' });

    await aioli.mount([referenceFile, selectedInputsFile]);
    this.hasMountedFiles = true;

    // Stage 1: Index reference & align selected input records with minimap2
    onStageChange?.(PIPELINE_STATUS.ALIGNING);
    await this.execAndVerifyFile(aioli, 'samtools', ['faidx', REFERENCE_FILE], REFERENCE_FAI_FILE);
    await this.execAndVerifyFile(
      aioli,
      'minimap2',
      ['-a', '-x', preset, REFERENCE_FILE, SELECTED_INPUTS_FILE, '-o', ALIGNED_SAM_FILE],
      ALIGNED_SAM_FILE,
    );

    // Stage 2: Convert SAM -> BAM, sort, and index
    onStageChange?.(PIPELINE_STATUS.SORTING_INDEXING);
    await this.execAndVerifyFile(
      aioli,
      'samtools',
      ['view', '-bS', ALIGNED_SAM_FILE, '-o', ALIGNED_BAM_FILE],
      ALIGNED_BAM_FILE,
    );
    await this.execAndVerifyFile(
      aioli,
      'samtools',
      ['sort', ALIGNED_BAM_FILE, '-o', SORTED_BAM_FILE],
      SORTED_BAM_FILE,
    );
    await this.execAndVerifyFile(
      aioli,
      'samtools',
      ['index', SORTED_BAM_FILE],
      SORTED_BAI_FILE,
    );

    const [bamBlob, baiBlob, refFastaBlob, refFaiBlob] = await Promise.all([
      this.requireBlob(aioli, SORTED_BAM_FILE),
      this.requireBlob(aioli, SORTED_BAI_FILE),
      this.requireBlob(aioli, REFERENCE_FILE),
      this.requireBlob(aioli, REFERENCE_FAI_FILE),
    ]);

    const executionTimeMs = Math.round(performance.now() - tStart);

    return {
      baiBlobUrl: URL.createObjectURL(baiBlob),
      bamBlobUrl: URL.createObjectURL(bamBlob),
      executionTimeMs,
      preset,
      referenceFaiBlobUrl: URL.createObjectURL(refFaiBlob),
      referenceFastaBlobUrl: URL.createObjectURL(refFastaBlob),
      referenceId: referenceSequence.id,
      referenceLength: referenceSequence.length,
      selectedIds: selectedSequences.map((seq) => seq.id),
    };
  }

  /**
   * Calls consensus strictly from the already-aligned BAM of selected records.
   */
  public async runConsensus(options: ConsensusRunOptions): Promise<ConsensusResult> {
    const { alignmentResult, onStageChange, params } = options;
    const tStart = performance.now();

    onStageChange?.(PIPELINE_STATUS.CALLING_CONSENSUS);

    let aioli = this.aioli;
    const hasBamInWorker = aioli ? Boolean(await aioli.ls(SORTED_BAM_FILE)) : false;
    if (!aioli || !hasBamInWorker) {
      if (aioli) {
        await aioli.close();
        this.aioli = null;
        this.hasMountedFiles = false;
      }
      aioli = await this.init();
      const bamResponse = await fetch(alignmentResult.bamBlobUrl);
      if (!bamResponse.ok) {
        throw new Error('Aligned BAM data is no longer available. Please re-run alignment.');
      }
      const bamBlob = await bamResponse.blob();
      await aioli.mount([new File([bamBlob], SORTED_BAM_FILE)]);
      this.hasMountedFiles = true;
    }

    const consensusArgs = [
      'consensus',
      '-f',
      'fasta',
      '-m',
      params.mode,
      '--show-ins',
      params.showIns ? 'yes' : 'no',
      '--show-del',
      params.showDel ? 'yes' : 'no',
      '-d',
      String(params.minDepth),
      ...(params.mode === 'simple' ? ['-c', String(params.callFract)] : []),
      SORTED_BAM_FILE,
      '-o',
      CONSENSUS_FASTA_FILE,
    ];
    await this.execAndVerifyFile(aioli, 'samtools', consensusArgs, CONSENSUS_FASTA_FILE);

    const rawConsensus = await aioli.cat(CONSENSUS_FASTA_FILE);
    if (!rawConsensus || !rawConsensus.trim()) {
      throw new Error('samtools consensus produced an empty output.');
    }

    const parsedConsensus = FastaUtil.parseFasta(rawConsensus);
    if (parsedConsensus.error || parsedConsensus.sequences.length === 0) {
      throw new Error(parsedConsensus.error ?? 'Failed to parse consensus FASTA output.');
    }

    const consensusSequence = parsedConsensus.sequences.map((s) => s.sequence).join('');
    const consensusHeader = `merged_consensus_${alignmentResult.selectedIds.length}_records reference=${alignmentResult.referenceId}`;
    const consensusFasta = `>${consensusHeader}\n${consensusSequence}\n`;
    const executionTimeMs = Math.round(performance.now() - tStart);

    return {
      consensusFasta,
      consensusHeader,
      consensusSequence,
      executionTimeMs,
      params: { ...params },
      referenceId: alignmentResult.referenceId,
      selectedIds: [...alignmentResult.selectedIds],
    };
  }

  private async execAndVerifyFile(
    aioli: AioliInstance,
    command: string,
    args: string[],
    expectedOutputFile: string,
  ): Promise<void> {
    const fullCommand = `${command} ${args.join(' ')}`.trim();
    console.info('[RecordMergerAioliService] Executing:', fullCommand);
    const result = await aioli.exec(fullCommand);
    const outputLog = RecordMergerAioliService.formatExecOutput(result);
    if (outputLog) {
      console.info(`[RecordMergerAioliService] ${command} output:`, outputLog);
    }

    const stat = await aioli.ls(expectedOutputFile);
    if (!stat) {
      throw new Error(
        `Command '${fullCommand}' did not generate expected file '${expectedOutputFile}'.${outputLog ? ` Output: ${outputLog}` : ''}`,
      );
    }
  }

  private async init(): Promise<AioliInstance> {
    if (!this.aioli) {
      const cdnUrl = this.config?.aioli?.cdnUrl;
      this.aioli = await new Aioli(this.tools, {
        printInterleaved: false,
        ...(cdnUrl ? { urlCDN: cdnUrl, urlCDNStg: cdnUrl } : {}),
      });
    }
    return this.aioli;
  }

  private async requireBlob(aioli: AioliInstance, path: string): Promise<Blob> {
    const blob = await aioli.downloadBlob(path);
    if (!blob || blob.size === 0) {
      throw new Error(`Failed to export '${path}' from Biowasm workspace.`);
    }
    return blob;
  }
}
