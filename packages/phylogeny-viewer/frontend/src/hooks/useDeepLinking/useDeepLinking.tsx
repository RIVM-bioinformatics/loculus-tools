import { useEffect } from 'react';
import { useStore } from 'zustand/react';

import { EventBusService } from '../../classes/services/EventBusService';
import { calculationStore } from '../../stores/calculationStore';
import { uiStore } from '../../stores/uiStore';
import { CALCULATION_STATUS } from '../../models/calculation';

export const useDeepLinking = () => {
  const setFastaContent = useStore(uiStore, (state) => state.setFastaContent);
  const setMetadataContent = useStore(uiStore, (state) => state.setMetadataContent);
  const calculateTree = useStore(calculationStore, (state) => state.calculateTree);
  const setColorByField = useStore(uiStore, (state) => state.setColorByField);
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
              const metaRes = await fetch(inputMetadataUrl);
              if (metaRes.ok) {
                const metaText = await metaRes.text();
                setMetadataContent(metaText);
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
