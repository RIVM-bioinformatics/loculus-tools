import { useEffect } from 'react';
import { useStore } from 'zustand/react';

import { EventBusService } from '../services/EventBusService';
import { calculationStore } from '../stores/calculationStore';
import { datasetStore } from '../stores/datasetStore';
import { metadataStore } from '../stores/metadataStore';
import { CALCULATION_STATUS } from '../models/calculation';

export const useDeepLinking = () => {
  const setFastaContent = useStore(datasetStore, (state) => state.setFastaContent);
  const setMetadataContent = useStore(datasetStore, (state) => state.setMetadataContent);
  const calculateTree = useStore(calculationStore, (state) => state.calculateTree);
  const setColorByField = useStore(metadataStore, (state) => state.setColorByField);
  const setCalculationStatus = useStore(calculationStore, (state) => state.setCalculationStatus);

  useEffect(() => {
    // Scan URL parameters for deep-linking
    const urlParams = new URLSearchParams(window.location.search);
    const inputFastaUrl = urlParams.get('input-fasta');
    const inputMetadataUrl = urlParams.get('input-metadata');

    const handleDeepLinking = async () => {
      if (inputFastaUrl) {
        setCalculationStatus(CALCULATION_STATUS.LOADING);
        try {
          console.log('[App] Auto-fetching FASTA from URL:', inputFastaUrl);
          const fastaRes = await fetch(inputFastaUrl);
          if (!fastaRes.ok) {
            throw new Error(`FASTA fetch failed (${fastaRes.status})`);
          }
          const fastaText = await fastaRes.text();

          const fastaResult = setFastaContent(fastaText);
          if (!fastaResult.isAligned) {
            EventBusService.getInstance().emit('onShowAlignmentErrorDialog');
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
                    ['clade', 'country', 'division', 'host', 'lineage', 'region'].includes(c.toLowerCase())) || metaResult.columns[0];
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
          EventBusService.getInstance().emit('onShowImportDialog');
        }
      } else {
        // PV1-02: Show data loading modal if no data provided via URL query params
        EventBusService.getInstance().emit('onShowImportDialog');
      }
    };

    void handleDeepLinking();
  }, [setFastaContent, setMetadataContent, calculateTree, setColorByField, setCalculationStatus]);
};
