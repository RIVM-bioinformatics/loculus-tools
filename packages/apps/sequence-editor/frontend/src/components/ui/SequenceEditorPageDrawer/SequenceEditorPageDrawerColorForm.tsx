import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ChangeEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Typography,
} from '@mui/material';
import { GenericForm } from '@gen-epix/ui-core-form/components/helpers/GenericForm';
import type { FormFieldDefinition } from '@gen-epix/ui-core-form/models/form.models';
import { FORM_FIELD_DEFINITION_TYPE } from '@gen-epix/ui-core-form/models/form.models';
import { useForm } from 'react-hook-form';
import { UrlUtil } from '@rivm-loculus-tools/common-frontend/utils/UrlUtil';
import { DownloadUtil } from '@gen-epix/ui-core/utils/DownloadUtil';

import { PALETTE_SCHEMA_URL_PATH } from '../../../constants/palette';
import type { PaletteEntry } from '../../../models/palette.models';
import { CUSTOM_PALETTE_NAME } from '../../../models/palette.models';
import { HEX_COLOR_REGEX } from '../../../utils/PaletteUtil';

import { SequenceEditorPageDrawerColorPicker } from './SequenceEditorPageDrawerColorPicker';

export type SequenceEditorPageDrawerColorFormProps<TSymbol extends string> = {
  currentPalette: PaletteWithSymbols<TSymbol>;
  customPalette: PaletteWithSymbols<TSymbol>;
  exportFileName: string;
  label: string;
  onPaletteChange: (palette: PaletteWithSymbols<TSymbol>) => void;
  palettes: readonly PaletteWithSymbols<TSymbol>[];
  parsePalette: (value: unknown) => PaletteWithSymbols<TSymbol>;
  symbolLabels: Readonly<Record<TSymbol, string>>;
  symbols: readonly TSymbol[];
};

type FormFields = {
  palette?: string;
};

type PaletteWithSymbols<TSymbol extends string> = {
  name: string;
  paletteColors: Record<TSymbol, PaletteEntry>;
};

const COLOR_FIELDS: readonly (keyof PaletteEntry)[] = [
  'background',
  'foreground',
  'backgroundSelected',
  'foregroundSelected',
];

const COLOR_FIELD_LABELS: Record<keyof PaletteEntry, string> = {
  background: 'Background',
  backgroundSelected: 'Selected background',
  foreground: 'Text',
  foregroundSelected: 'Selected text',
};

export const SequenceEditorPageDrawerColorForm = <TSymbol extends string, >({
  currentPalette,
  customPalette,
  exportFileName,
  label,
  onPaletteChange,
  palettes,
  parsePalette,
  symbolLabels,
  symbols,
}: SequenceEditorPageDrawerColorFormProps<TSymbol>) => {
  const formId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<null | string>(null);

  const onChangePalette = useCallback((paletteName: string) => {
    const palette = paletteName === CUSTOM_PALETTE_NAME
      ? customPalette
      : palettes.find((candidate) => candidate.name === paletteName);
    if (palette) {
      onPaletteChange(palette);
    }
  }, [customPalette, onPaletteChange, palettes]);

  const paletteOptions = useMemo(() => [
    ...palettes.map((palette) => ({
      label: palette.name,
      value: palette.name,
    })),
    {
      label: CUSTOM_PALETTE_NAME,
      value: CUSTOM_PALETTE_NAME,
    },
  ], [palettes]);

  const formFieldDefinitions = useMemo<FormFieldDefinition<FormFields>[]>(() => [
    {
      definition: FORM_FIELD_DEFINITION_TYPE.RADIO_GROUP,
      label,
      name: 'palette',
      onChange: onChangePalette,
      options: paletteOptions,
      required: true,
    } as const satisfies FormFieldDefinition<FormFields>,
  ] as const, [label, onChangePalette, paletteOptions]);

  const values = useMemo<FormFields>(() => ({
    palette: currentPalette.name,
  }), [currentPalette.name]);

  const formMethods = useForm<FormFields>({
    values,
  });
  const { handleSubmit } = formMethods;

  const onFormSubmit = useCallback((_formValues: FormFields) => {
    // do nothing
  }, []);

  const onColorChange = useCallback((
    symbol: TSymbol,
    field: keyof PaletteEntry,
    color: string,
  ) => {
    if (!HEX_COLOR_REGEX.test(color)) {
      return;
    }

    onPaletteChange({
      ...customPalette,
      paletteColors: {
        ...customPalette.paletteColors,
        [symbol]: {
          ...customPalette.paletteColors[symbol],
          [field]: color,
        },
      },
    });
  }, [customPalette, onPaletteChange]);

  const onImportFile = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    try {
      const paletteJson = JSON.parse(await file.text()) as unknown;
      const palette = parsePalette(paletteJson);
      onPaletteChange({
        ...palette,
        name: CUSTOM_PALETTE_NAME,
      });
      setImportError(null);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unexpected error while reading the file.';
      setImportError(`Could not import palette: ${reason}`);
    }
  }, [onPaletteChange, parsePalette]);

  const onExportPalette = useCallback(() => {
    const paletteExport = {
      ...currentPalette,
      $schema: new URL(PALETTE_SCHEMA_URL_PATH, UrlUtil.getBaseURLWithPath()).href,
    };
    const file = new Blob([JSON.stringify(paletteExport, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(file);
    DownloadUtil.createDownloadUrl(url, exportFileName);
    URL.revokeObjectURL(url);
  }, [currentPalette, exportFileName]);

  const onImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <Box sx={{ '& + &': { mt: 2 } }}>
      <GenericForm<FormFields>
        formFieldDefinitions={formFieldDefinitions}
        formId={formId}
        formMethods={formMethods}
        onSubmit={handleSubmit(onFormSubmit)}
      />
      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
        <Button
          onClick={onImportClick}
          size={'small'}
          variant={'outlined'}
        >
          {'Import'}
        </Button>
        <Button
          onClick={onExportPalette}
          size={'small'}
          variant={'outlined'}
        >
          {'Export'}
        </Button>
        <input
          accept={'.json,application/json'}
          aria-label={`Import ${label} JSON`}
          onChange={onImportFile}
          ref={fileInputRef}
          style={{ display: 'none' }}
          type={'file'}
        />
      </Box>
      {importError && (
        <Alert
          severity={'error'}
          sx={{ mt: 1 }}
        >
          {importError}
        </Alert>
      )}
      {currentPalette.name === CUSTOM_PALETTE_NAME && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            mt: 2,
          }}
        >
          {symbols.map((symbol) => {
            const symbolName = String(symbol);
            const symbolLabel = `${symbolLabels[symbol]} (${symbolName})`;
            const colors = customPalette.paletteColors[symbol];

            return (
              <Box
                key={symbolName}
                sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}
              >
                <Typography
                  sx={{ fontWeight: 600, mb: 1 }}
                  variant={'body2'}
                >
                  {symbolLabel}
                </Typography>
                <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                  {COLOR_FIELDS.map((field) => (
                    <SequenceEditorPageDrawerColorPicker
                      field={field}
                      key={field}
                      label={`${symbolLabel} ${COLOR_FIELD_LABELS[field]}`}
                      onColorChange={onColorChange}
                      symbol={symbol}
                      value={colors[field]}
                    />
                  ))}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};
