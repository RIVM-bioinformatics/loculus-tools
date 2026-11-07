import {
  Alert,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import type { DialogAction } from '@gen-epix/ui-core-components/components/Dialog';
import { Spinner } from '@gen-epix/ui-core-components/components/Spinner';
import type {
  WithDialogRefMethods,
  WithDialogRenderProps,
} from '@gen-epix/ui-core-components/hoc/withDialog';
import { withDialog } from '@gen-epix/ui-core-components/hoc/withDialog';
import type { ReactElement } from 'react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { container } from 'tsyringe';

import { LoculusService } from '../../../classes/services/LoculusService';
import { UrlService } from '../../../classes/services/UrlService';
import type { MetadataParseResult } from '../../../models/metadata.models';
import { FastaUtil } from '../../../utils/FastaUtil';

export interface UploadToLoculusModalOpenProps {
  fasta: string;
  metaData: MetadataParseResult | null;
  rawFasta: string;
}

export interface UploadToLoculusModalProps extends WithDialogRenderProps<UploadToLoculusModalOpenProps> {
  //
}

export type UploadToLoculusModalRefMethods = WithDialogRefMethods<UploadToLoculusModalProps, UploadToLoculusModalOpenProps>;

export const UploadToLoculusModal = withDialog<UploadToLoculusModalProps, UploadToLoculusModalOpenProps>(({
  onActionsChange,
  onClose,
  openProps,
}: UploadToLoculusModalProps): ReactElement => {
  const loculusService = useMemo(() => container.resolve(LoculusService), []);
  const urlService = useMemo(() => container.resolve(UrlService), []);
  const [isUploading, setIsUploading] = useState(false);
  const [didUpload, setDidUpload] = useState(false);
  const [uploadError, setUploadError] = useState<null | string>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fasta = openProps?.fasta ?? '';
  const metaData = openProps?.metaData ?? null;
  const rawFasta = openProps?.rawFasta ?? '';

  useEffect(() => () => {
    abortControllerRef.current?.abort();
  }, []);

  const validation = useMemo(() => {
    const errors: string[] = [];
    if (!loculusService.data.authenticated) {
      errors.push('You must be authenticated to upload to Loculus.');
    }
    if (!urlService.hasReturnParams()) {
      errors.push('The Loculus return URL and organism must be provided.');
    }
    if (!metaData) {
      errors.push('Metadata must be loaded before uploading.');
    }

    const parsedFasta = FastaUtil.parseFasta(fasta);
    if (parsedFasta.error) {
      errors.push(parsedFasta.error);
    } else if (parsedFasta.sequences.length === 0) {
      errors.push('At least one FASTA sequence is required.');
    }

    if (metaData?.error) {
      errors.push(metaData.error);
    }

    if (errors.length > 0 || !metaData) {
      return { errors, revisedSequences: null };
    }

    try {
      const revisedSequences = LoculusService.createRevisedSequences(fasta, metaData, rawFasta);
      if (revisedSequences.sequenceCount === 0) {
        errors.push('No FASTA sequences match the metadata.');
      }
      return {
        errors,
        revisedSequences,
      };
    } catch (error: unknown) {
      errors.push(error instanceof Error ? error.message : 'Failed to prepare the upload preview.');
      return { errors, revisedSequences: null };
    }
  }, [fasta, loculusService, metaData, rawFasta, urlService]);
  const previewMetadataRows = validation.revisedSequences?.metadata
    .split('\n')
    .slice(1)
    .filter((row) => row.length > 0)
    .reduce<{ key: string; values: string[] }[]>((rows, row) => {
      const occurrence = rows.filter((existingRow) => existingRow.key.startsWith(`${row}-`)).length;
      rows.push({ key: `${row}-${occurrence}`, values: row.split('\t') });
      return rows;
    }, []);

  const onClickUpload = useCallback(async () => {
    if (validation.errors.length > 0 || !validation.revisedSequences || !metaData || !urlService.hasReturnParams()) {
      return;
    }

    setUploadError(null);
    setIsUploading(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    try {
      const { organism, returnUrl } = urlService.data;
      await loculusService.reviseSequences(fasta, metaData, returnUrl, organism, abortController);
      setDidUpload(true);
    } catch (error: unknown) {
      if (!abortController.signal.aborted) {
        setUploadError(error instanceof Error ? error.message : 'Failed to upload sequences to Loculus.');
      }
    } finally {
      if (!abortController.signal.aborted) {
        abortControllerRef.current = null;
        setIsUploading(false);
      }
    }
  }, [fasta, loculusService, metaData, urlService, validation.errors.length, validation.revisedSequences]);

  const onCancelUpload = useCallback(() => {
    abortControllerRef.current?.abort();
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    const actions: DialogAction[] = didUpload
      ? [{
        label: 'Close tab',
        onClick: () => window.close(),
        variant: 'contained',
      }]
      : [
        ...(isUploading ? [{
          label: 'Cancel',
          onClick: onCancelUpload,
          variant: 'outlined' as const,
        }] : []),
        {
          disabled: isUploading || validation.errors.length > 0 || validation.revisedSequences === null,
          label: 'Upload',
          onClick: onClickUpload,
          variant: 'contained',
        },
      ];
    onActionsChange?.(actions);
  }, [didUpload, isUploading, onActionsChange, onCancelUpload, onClickUpload, validation.errors.length, validation.revisedSequences]);

  return (
    <Box sx={{ display: 'grid', gap: 2, position: 'relative' }}>
      {isUploading ? (
        <Spinner
          inline
          label={'Uploading sequences to Loculus'}
        />
      ) : (
        <>
          {validation.errors.length > 0 && (
            <Alert severity={'error'}>
              {validation.errors.join(' ')}
            </Alert>
          )}
          {uploadError && (
            <Alert severity={'error'}>
              {uploadError}
            </Alert>
          )}
          {didUpload && (
            <Alert severity={'success'}>
              {'Sequences successfully uploaded to Loculus. You can close this tab.'}
            </Alert>
          )}
          {!didUpload && validation.revisedSequences && (
            <>
              <Alert severity={'info'}>
                {`${validation.revisedSequences.sequenceCount} sequence(s) and the matching metadata will be uploaded to Loculus.`}
              </Alert>
              {validation.revisedSequences.removedSequences.length > 0 && (
                <Alert severity={'warning'}>
                  {`Sequences removed during editing and therefore not uploaded: ${validation.revisedSequences.removedSequences.length}`}
                </Alert>
              )}
              {validation.revisedSequences.addedSequencesWithoutMetadata.length > 0 && (
                <Alert severity={'warning'}>
                  {`Added sequences without matching metadata will not be uploaded: ${validation.revisedSequences.addedSequencesWithoutMetadata.length}`}
                </Alert>
              )}
              <TableContainer
                component={Paper}
                sx={{ maxHeight: '400px', overflowX: 'auto' }}
              >
                <Table
                  size={'small'}
                  stickyHeader
                  sx={{ minWidth: '100%', whiteSpace: 'nowrap', width: 'max-content' }}
                >
                  <TableHead>
                    <TableRow>
                      {metaData?.columns.map((column) => (
                        <TableCell key={column}>
                          {column}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {previewMetadataRows?.map(({ key, values }) => (
                      <TableRow key={key}>
                        {values.map((value, columnIndex) => (
                          <TableCell key={`${key}-${metaData?.columns[columnIndex] ?? columnIndex}`}>
                            {value}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </>
      )}
    </Box>
  );
}, {
  defaultTitle: 'Upload to Loculus',
  fullWidth: true,
  maxWidth: 'md',
  testId: 'UploadToLoculusModal',
});
