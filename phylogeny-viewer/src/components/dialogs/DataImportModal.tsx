import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Tabs,
  Tab,
  TextField,
  Paper,
  Divider,
  Alert,
  IconButton,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DnaIcon from '@mui/icons-material/Biotech';
import TableChartIcon from '@mui/icons-material/TableChart';
import { FileDropZone } from '../common/FileDropZone';
import { useDatasetStore } from '../../stores/datasetStore';
import { useCalculationStore } from '../../stores/calculationStore';
import { useTreeViewStore } from '../../stores/treeViewStore';
import { useMetadataStore } from '../../stores/metadataStore';

export const DataImportModal: React.FC = () => {
  const open = useTreeViewStore((state) => state.importModalOpen);
  const setOpen = useTreeViewStore((state) => state.setImportModalOpen);

  const setFastaContent = useDatasetStore((state) => state.setFastaContent);
  const setMetadataContent = useDatasetStore((state) => state.setMetadataContent);
  const calculateTree = useCalculationStore((state) => state.calculateTree);
  const setColorByField = useMetadataStore((state) => state.setColorByField);

  // FASTA state
  const [fastaTab, setFastaTab] = useState(0); // 0: Drop, 1: URL, 2: Paste
  const [fastaFile, setFastaFile] = useState<File | null>(null);
  const [fastaUrl, setFastaUrl] = useState('');
  const [fastaText, setFastaText] = useState('');

  // Metadata state
  const [metadataTab, setMetadataTab] = useState(0); // 0: Drop, 1: URL, 2: Paste
  const [metadataFile, setMetadataFile] = useState<File | null>(null);
  const [metadataUrl, setMetadataUrl] = useState('');
  const [metadataText, setMetadataText] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleClose = () => {
    if (!isLoading) {
      setOpen(false);
      setErrorMsg(null);
    }
  };

  const handleLoadData = async () => {
    setErrorMsg(null);
    setIsLoading(true);

    try {
      // 1. Resolve FASTA content
      let fastaContent = '';
      if (fastaTab === 0 && fastaFile) {
        fastaContent = await fastaFile.text();
      } else if (fastaTab === 1 && fastaUrl.trim()) {
        const res = await fetch(fastaUrl.trim());
        if (!res.ok) throw new Error(`Failed to fetch FASTA from URL (${res.status} ${res.statusText})`);
        fastaContent = await res.text();
      } else if (fastaTab === 2 && fastaText.trim()) {
        fastaContent = fastaText.trim();
      }

      if (!fastaContent || !fastaContent.trim()) {
        throw new Error('Please provide FASTA sequence data via file, URL, or paste.');
      }

      // 2. Resolve Metadata content (optional)
      let metadataContent = '';
      if (metadataTab === 0 && metadataFile) {
        metadataContent = await metadataFile.text();
      } else if (metadataTab === 1 && metadataUrl.trim()) {
        const res = await fetch(metadataUrl.trim());
        if (!res.ok) throw new Error(`Failed to fetch Metadata from URL (${res.status} ${res.statusText})`);
        metadataContent = await res.text();
      } else if (metadataTab === 2 && metadataText.trim()) {
        metadataContent = metadataText.trim();
      }

      // 3. Parse & Validate FASTA
      const fastaResult = setFastaContent(fastaContent);
      if (!fastaResult.isAligned) {
        // Alignment error will be shown by AlignmentErrorDialog
        setIsLoading(false);
        setOpen(false);
        return;
      }

      // 4. Parse Metadata
      if (metadataContent) {
        const metaResult = setMetadataContent(metadataContent);
        if (metaResult.columns.length > 0) {
          // Default color by first non-ID column if available
          const preferredCols = ['country', 'region', 'host', 'division', 'lineage', 'clade'];
          const matched = metaResult.columns.find((c) => preferredCols.includes(c.toLowerCase()));
          const defaultField = matched || metaResult.columns.find((c) => c !== 'accessionVersion' && c !== 'SampleID' && c !== 'id') || metaResult.columns[0];
          if (defaultField) {
            const vals = metaResult.records.map((r) => r[defaultField] || '');
            const uniqueVals = Array.from(new Set(vals.filter(Boolean)));
            setColorByField(defaultField, uniqueVals, vals);
          }
        }
      }

      // 5. Calculate default tree
      setOpen(false);
      await calculateTree(fastaContent);
    } catch (err: any) {
      console.error('Data import failed:', err);
      setErrorMsg(err?.message || 'Failed to load dataset.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadDemoData = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const [fastaRes, metaRes] = await Promise.all([
        fetch('/sample-data/sarscov2_aligned.fasta'),
        fetch('/sample-data/sarscov2_metadata.tsv'),
      ]);
      const fastaText = await fastaRes.text();
      const metaText = await metaRes.text();

      setFastaContent(fastaText);
      const metaResult = setMetadataContent(metaText);
      if (metaResult.columns.length > 0) {
        const field = 'country';
        const vals = metaResult.records.map((r) => r[field] || '');
        const uniqueVals = Array.from(new Set(vals.filter(Boolean)));
        setColorByField(field, uniqueVals, vals);
      }
      setOpen(false);
      await calculateTree(fastaText);
    } catch (err: any) {
      setErrorMsg('Failed to load demo dataset: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // const handleLoadRSVDemoData = async () => {
  //   try {
  //     setIsLoading(true);
  //     setErrorMsg(null);
  //     const [fastaRes, metaRes] = await Promise.all([
  //       fetch('/sample-data/rsv-a_aligned-nuc_2026-08-15T0738.fasta'),
  //       fetch('/sample-data/rsv-a_metadata_2026-08-15T0740.tsv'),
  //     ]);
  //     const fastaText = await fastaRes.text();
  //     const metaText = await metaRes.text();

  //     setFastaContent(fastaText);
  //     const metaResult = setMetadataContent(metaText);
  //     if (metaResult.columns.length > 0) {
  //       const field = metaResult.columns.includes('lineage') ? 'lineage' : 'displayName';
  //       const vals = metaResult.records.map((r) => r[field] || '');
  //       const uniqueVals = Array.from(new Set(vals.filter(Boolean)));
  //       setColorByField(field, uniqueVals, vals);
  //     }
  //     setOpen(false);
  //     await calculateTree(fastaText);
  //   } catch (err: any) {
  //     setErrorMsg('Failed to load RSV-A demo dataset: ' + err.message);
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Load Phylogenetic Data
        </Typography>
        <IconButton onClick={handleClose} disabled={isLoading} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, py: 3 }}>
        {errorMsg && (
          <Alert severity="error" onClose={() => setErrorMsg(null)}>
            {errorMsg}
          </Alert>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
          {/* FASTA Sequences Group */}
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <DnaIcon color="primary" />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                1. FASTA Sequences (Required)
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Pre-aligned nucleotide or amino-acid sequence data.
            </Typography>

            <Tabs value={fastaTab} onChange={(_, val) => setFastaTab(val)} sx={{ mb: 2, minHeight: 36 }}>
              <Tab label="File Upload" sx={{ py: 0.5, fontSize: '0.85rem' }} />
              <Tab label="Public URL" sx={{ py: 0.5, fontSize: '0.85rem' }} />
              <Tab label="Direct Paste" sx={{ py: 0.5, fontSize: '0.85rem' }} />
            </Tabs>

            {fastaTab === 0 && (
              <FileDropZone
                label="FASTA File"
                accept=".fasta,.fa,.fna,.aln"
                file={fastaFile}
                onFileSelected={(f) => setFastaFile(f)}
                helperText="Drag & drop .fasta / .fa alignment file"
              />
            )}

            {fastaTab === 1 && (
              <Box sx={{ minHeight: 180, display: 'flex', flexDirection: 'column', gap: 1.5, justifyContent: 'center' }}>
                <TextField
                  label="FASTA URL"
                  placeholder="https://example.com/sequences.fasta"
                  variant="outlined"
                  fullWidth
                  value={fastaUrl}
                  onChange={(e) => setFastaUrl(e.target.value)}
                  helperText="Enter a publicly accessible URL to a FASTA alignment"
                />
              </Box>
            )}

            {fastaTab === 2 && (
              <Box sx={{ minHeight: 180 }}>
                <TextField
                  label="Paste FASTA Content"
                  placeholder=">seq1&#10;ACTG...&#10;>seq2&#10;ACTG..."
                  variant="outlined"
                  multiline
                  rows={6}
                  fullWidth
                  value={fastaText}
                  onChange={(e) => setFastaText(e.target.value)}
                  sx={{ fontFamily: 'monospace' }}
                />
              </Box>
            )}
          </Paper>

          {/* TSV Metadata Group */}
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <TableChartIcon color="secondary" />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                2. TSV Metadata (Optional)
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Sample attributes for coloring, search & custom leaf labels.
            </Typography>

            <Tabs value={metadataTab} onChange={(_, val) => setMetadataTab(val)} sx={{ mb: 2, minHeight: 36 }}>
              <Tab label="File Upload" sx={{ py: 0.5, fontSize: '0.85rem' }} />
              <Tab label="Public URL" sx={{ py: 0.5, fontSize: '0.85rem' }} />
              <Tab label="Direct Paste" sx={{ py: 0.5, fontSize: '0.85rem' }} />
            </Tabs>

            {metadataTab === 0 && (
              <FileDropZone
                label="TSV Metadata File"
                accept=".tsv,.txt,.csv"
                file={metadataFile}
                onFileSelected={(f) => setMetadataFile(f)}
                helperText="Drag & drop .tsv / .csv metadata file"
              />
            )}

            {metadataTab === 1 && (
              <Box sx={{ minHeight: 180, display: 'flex', flexDirection: 'column', gap: 1.5, justifyContent: 'center' }}>
                <TextField
                  label="Metadata TSV URL"
                  placeholder="https://example.com/metadata.tsv"
                  variant="outlined"
                  fullWidth
                  value={metadataUrl}
                  onChange={(e) => setMetadataUrl(e.target.value)}
                  helperText="Enter a publicly accessible URL to a TSV metadata file"
                />
              </Box>
            )}

            {metadataTab === 2 && (
              <Box sx={{ minHeight: 180 }}>
                <TextField
                  label="Paste TSV Content"
                  placeholder="SampleID&#9;Country&#9;Date&#10;Sample1&#9;NL&#9;2024-01-01"
                  variant="outlined"
                  multiline
                  rows={6}
                  fullWidth
                  value={metadataText}
                  onChange={(e) => setMetadataText(e.target.value)}
                  sx={{ fontFamily: 'monospace' }}
                />
              </Box>
            )}
          </Paper>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2.5, justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button onClick={handleClose} disabled={isLoading} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleLoadDemoData}
            disabled={isLoading}
            variant="outlined"
            color="secondary"
            size="small"
          >
            Demo (SARS-CoV-2)
          </Button>
          {/* <Button
            onClick={handleLoadRSVDemoData}
            disabled={isLoading}
            variant="outlined"
            color="primary"
            size="small"
          >
            Demo (RSV-A, 279 Taxa)
          </Button> */}
        </Box>
        <Button
          onClick={handleLoadData}
          variant="contained"
          color="primary"
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : undefined}
          sx={{ minWidth: 140, py: 1 }}
        >
          {isLoading ? 'Processing...' : 'Load & Calculate'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
