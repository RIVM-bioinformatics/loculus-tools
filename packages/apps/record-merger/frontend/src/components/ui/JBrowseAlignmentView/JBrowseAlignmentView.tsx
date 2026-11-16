import { useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
} from '@mui/material';
import {
  createViewState,
  JBrowseLinearGenomeView,
} from '@jbrowse/react-linear-genome-view2';

import type { AlignmentResult } from '../../../models/pipeline.models';

export type JBrowseAlignmentViewProps = {
  alignmentResult: AlignmentResult;
};

const ALIGNMENTS_TRACK_ID = 'record-merger-bam-track';

export const JBrowseAlignmentView = ({ alignmentResult }: JBrowseAlignmentViewProps) => {
  const viewState = useMemo(() => {
    const referenceTrackId = `${alignmentResult.referenceId}-ReferenceSequenceTrack`;
    const sequenceAdapter = {
      faiLocation: {
        locationType: 'UriLocation' as const,
        uri: alignmentResult.referenceFaiBlobUrl,
      },
      fastaLocation: {
        locationType: 'UriLocation' as const,
        uri: alignmentResult.referenceFastaBlobUrl,
      },
      type: 'IndexedFastaAdapter' as const,
    };

    return createViewState({
      assembly: {
        name: alignmentResult.referenceId,
        sequence: {
          adapter: sequenceAdapter,
          trackId: referenceTrackId,
          type: 'ReferenceSequenceTrack',
        },
      },
      defaultSession: {
        name: 'Record Merger Alignment Session',
        view: {
          id: 'linearGenomeView',
          tracks: [
            {
              configuration: referenceTrackId,
              displays: [
                {
                  configuration: `${referenceTrackId}-LinearReferenceSequenceDisplay`,
                  type: 'LinearReferenceSequenceDisplay',
                },
              ],
              type: 'ReferenceSequenceTrack',
            },
            {
              configuration: ALIGNMENTS_TRACK_ID,
              displays: [
                {
                  configuration: `${ALIGNMENTS_TRACK_ID}-LinearAlignmentsDisplay`,
                  type: 'LinearAlignmentsDisplay',
                },
              ],
              type: 'AlignmentsTrack',
            },
          ],
          type: 'LinearGenomeView',
        },
      },
      location: `${alignmentResult.referenceId}:1..${alignmentResult.referenceLength}`,
      tracks: [
        {
          adapter: {
            bamLocation: {
              locationType: 'UriLocation',
              uri: alignmentResult.bamBlobUrl,
            },
            index: {
              indexType: 'BAI',
              location: {
                locationType: 'UriLocation',
                uri: alignmentResult.baiBlobUrl,
              },
            },
            sequenceAdapter,
            type: 'BamAdapter',
          },
          assemblyNames: [alignmentResult.referenceId],
          name: 'Aligned Selected Records (BAM)',
          trackId: ALIGNMENTS_TRACK_ID,
          type: 'AlignmentsTrack',
        },
      ],
    });
  }, [alignmentResult]);

  return (
    <Paper
      sx={{ borderRadius: 2, overflow: 'hidden', p: 2 }}
      variant={'outlined'}
    >
      <Box sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography
          sx={{ fontWeight: 700 }}
          variant={'subtitle1'}
        >
          {'JBrowse2 Linear Genome Alignment View'}
        </Typography>
        <Typography
          color={'text.secondary'}
          variant={'caption'}
        >
          {`Reference: ${alignmentResult.referenceId} | Track: ${alignmentResult.selectedIds.length} aligned BAM records (${alignmentResult.preset})`}
        </Typography>
      </Box>
      <Box sx={{ minHeight: 380, width: '100%' }}>
        <JBrowseLinearGenomeView viewState={viewState} />
      </Box>
    </Paper>
  );
};
