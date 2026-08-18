import React, { useEffect } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { phyloTheme } from './theme/phyloTheme';
import { initGenEpixConfig } from './theme/initGenEpixConfig';
import { AppLayout } from './components/app/AppLayout';
import { preloaderService } from './services/biowasm/preloaderService';
import { useDatasetStore } from './stores/datasetStore';
import { useCalculationStore } from './stores/calculationStore';
import { useTreeViewStore } from './stores/treeViewStore';
import { useMetadataStore } from './stores/metadataStore';

export const App: React.FC = () => {
  const setFastaContent = useDatasetStore((state) => state.setFastaContent);
  const setMetadataContent = useDatasetStore((state) => state.setMetadataContent);
  const calculateTree = useCalculationStore((state) => state.calculateTree);
  const setImportModalOpen = useTreeViewStore((state) => state.setImportModalOpen);
  const setColorByField = useMetadataStore((state) => state.setColorByField);

  useEffect(() => {
    // 1. Initialize Gen-Epix config defaults
    initGenEpixConfig();

    // 2. Start preloading WASM modules (FastTree & TN93) in parallel
    preloaderService.preloadAll().catch((err) => {
      console.warn('[App] Background WASM preload warning:', err);
    });

    // 3. Scan URL parameters for deep-linking
    const urlParams = new URLSearchParams(window.location.search);
    const inputFastaUrl = urlParams.get('input-fasta');
    const inputMetadataUrl = urlParams.get('input-metadata');

    const handleDeepLinking = async () => {
      if (inputFastaUrl) {
        try {
          console.log('[App] Auto-fetching FASTA from URL:', inputFastaUrl);
          const fastaRes = await fetch(inputFastaUrl);
          if (!fastaRes.ok) throw new Error(`FASTA fetch failed (${fastaRes.status})`);
          const fastaText = await fastaRes.text();

          const fastaResult = setFastaContent(fastaText);
          if (!fastaResult.isAligned) {
            return;
          }

          if (inputMetadataUrl) {
            try {
              console.log('[App] Auto-fetching Metadata from URL:', inputMetadataUrl);
              const metaRes = await fetch(inputMetadataUrl);
              if (metaRes.ok) {
                const metaText = await metaRes.text();
                const metaResult = setMetadataContent(metaText);
                if (metaResult.columns.length > 0) {
                  const preferred = metaResult.columns.find((c) =>
                    ['country', 'region', 'host', 'division', 'lineage', 'clade'].includes(c.toLowerCase())
                  ) || metaResult.columns[0];
                  if (preferred) {
                    const vals = metaResult.records.map((r) => r[preferred] || '');
                    const uniqueVals = Array.from(new Set(vals.filter(Boolean)));
                    setColorByField(preferred, uniqueVals, vals);
                  }
                }
              }
            } catch (metaErr) {
              console.warn('[App] Failed to auto-fetch metadata:', metaErr);
            }
          }

          // Automatically calculate initial tree
          await calculateTree(fastaText);
        } catch (fastaErr) {
          console.error('[App] Failed to auto-load FASTA:', fastaErr);
          setImportModalOpen(true);
        }
      } else {
        // PV1-02: Show data loading modal if no data provided via URL query params
        setImportModalOpen(true);
      }
    };

    handleDeepLinking();
  }, [setFastaContent, setMetadataContent, calculateTree, setImportModalOpen, setColorByField]);

  return (
    <ThemeProvider theme={phyloTheme}>
      <CssBaseline />
      <AppLayout />
    </ThemeProvider>
  );
};
