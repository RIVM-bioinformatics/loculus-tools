import { container } from 'tsyringe';
import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import { useStore } from 'zustand';
import { PageCommonDrawer } from '@rivm-loculus-tools/common-frontend/components/ui/PageCommonDrawer';
import { FastaDataEventBusService } from '@rivm-loculus-tools/common-frontend/classes/services/FastaDataEventBusService';

import { recordMergerStore } from '../../../stores/recordMergerStore';

import { RecordMergerPageDrawerMetadataSettings } from './RecordMergerPageDrawerMetadataSettings';
import { RecordMergerPageDrawerPipelineSettings } from './RecordMergerPageDrawerPipelineSettings';

enum ACCORDIONS {
  METADATA = 'METADATA',
  PIPELINE = 'PIPELINE',
}

export const RecordMergerPageDrawer = () => {
  const parsedMetadata = useStore(recordMergerStore, (state) => state.parsedMetadata);
  const [expandedAccordions, setExpandedAccordions] = useState<ACCORDIONS[]>([ACCORDIONS.PIPELINE]);

  const toggleAccordion = useCallback((panel: ACCORDIONS) => {
    setExpandedAccordions((prev) =>
      prev.includes(panel) ? prev.filter((p) => p !== panel) : [...prev, panel]);
  }, []);

  const collapseAccordion = useCallback((panel: ACCORDIONS) => {
    setExpandedAccordions((prev) => prev.filter((p) => p !== panel));
  }, []);

  const onClickLoadData = useCallback(() => {
    container.resolve(FastaDataEventBusService).emit('onShowImportDialog');
  }, []);

  const onPipelineAccordionChange = useCallback(() => {
    toggleAccordion(ACCORDIONS.PIPELINE);
  }, [toggleAccordion]);

  const onMetadataAccordionChange = useCallback(() => {
    toggleAccordion(ACCORDIONS.METADATA);
  }, [toggleAccordion]);

  useEffect(() => {
    if (!parsedMetadata) {
      collapseAccordion(ACCORDIONS.METADATA);
    }
  }, [collapseAccordion, parsedMetadata]);

  return (
    <PageCommonDrawer>
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 1.5, p: 2 }}>
        <Button
          color={'primary'}
          fullWidth
          onClick={onClickLoadData}
          startIcon={<FileUploadOutlinedIcon />}
          sx={{ py: 0.75 }}
          variant={'outlined'}
        >
          {'Load / Replace Data'}
        </Button>
      </Box>
      <Box>
        <Accordion
          disableGutters
          elevation={0}
          expanded={expandedAccordions.includes(ACCORDIONS.PIPELINE)}
          onChange={onPipelineAccordionChange}
          sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
              <TuneOutlinedIcon
                color={'primary'}
                fontSize={'small'}
              />
              <Typography
                sx={{ fontWeight: 600 }}
                variant={'body2'}
              >
                {'Pipeline configuration'}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pb: 1.5, pt: 1, px: 2 }}>
            <RecordMergerPageDrawerPipelineSettings />
          </AccordionDetails>
        </Accordion>
        <Accordion
          disabled={!parsedMetadata}
          disableGutters
          elevation={0}
          expanded={expandedAccordions.includes(ACCORDIONS.METADATA)}
          onChange={onMetadataAccordionChange}
          sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
              <TableChartOutlinedIcon
                color={'primary'}
                fontSize={'small'}
              />
              <Typography
                sx={{ fontWeight: 600 }}
                variant={'body2'}
              >
                {'Metadata matching'}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pb: 1.5, pt: 1, px: 2 }}>
            <RecordMergerPageDrawerMetadataSettings />
          </AccordionDetails>
        </Accordion>
      </Box>
    </PageCommonDrawer>
  );
};
