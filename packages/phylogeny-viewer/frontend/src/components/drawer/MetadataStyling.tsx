import {
  useCallback,
  useId,
  useMemo,
} from 'react';
import {
  Box,
  Typography,
} from '@mui/material';
// import PaletteIcon from '@mui/icons-material/Palette';
// import StyleIcon from '@mui/icons-material/Style';
// import KeyIcon from '@mui/icons-material/Key';
import { useStore } from 'zustand';
import type {
  AutoCompleteOption,
  FormFieldDefinition,
} from '@gen-epix/ui-core-form/models/form';
import { FORM_FIELD_DEFINITION_TYPE } from '@gen-epix/ui-core-form/models/form';
import { FormUtil } from '@gen-epix/ui-core-form/utils/FormUtil';
import { useForm } from 'react-hook-form';
import { GenericForm } from '@gen-epix/ui-core-form/components/helpers/GenericForm';

import { metadataStore } from '../../stores/metadataStore';
import { datasetStore } from '../../stores/datasetStore';
import { StatusChip } from '../ui/StatusChip';
// import { StatusChip } from '../ui/StatusChip';

type FormFields = {
  colorByField?: string;
  matchKeyColumn?: string;
  selectedLabelFields?: string[];
};

export const MetadataStyling = () => {
  const formId = useId();
  const parsedMetadata = useStore(datasetStore, (state) => state.parsedMetadata);
  const parsedFasta = useStore(datasetStore, (state) => state.parsedFasta);

  const matchKeyColumn = useStore(metadataStore, (state) => state.matchKeyColumn);
  const setMatchKeyColumn = useStore(metadataStore, (state) => state.setMatchKeyColumn);
  const columnMatchCounts = useStore(metadataStore, (state) => state.columnMatchCounts);

  const colorByField = useStore(metadataStore, (state) => state.colorByField);
  const setColorByField = useStore(metadataStore, (state) => state.setColorByField);
  const selectedLabelFields = useStore(metadataStore, (state) => state.selectedLabelFields);
  const setSelectedLabelFields = useStore(metadataStore, (state) => state.setSelectedLabelFields);

  const columns = useMemo(() => parsedMetadata?.columns || [], [parsedMetadata]);

  const records = useMemo(() => parsedMetadata?.records ?? [], [parsedMetadata]);
  const totalTaxa = parsedFasta?.sequences?.length || 0;

  const onChangeColorBy = useCallback((field: string) => {
    if (field === 'none' || !field) {
      setColorByField(null);
      return;
    }
    const vals = records.map((r) => r[field] || '');
    const uniqueVals = Array.from(new Set(vals.filter(Boolean)));
    setColorByField(field, uniqueVals, vals);
  }, [records, setColorByField]);

  const onChangeMatchKey = useCallback((col: string) => {
    setMatchKeyColumn(col);
    // Refresh color by if active
    if (colorByField) {
      const vals = records.map((r) => r[colorByField] || '');
      const uniqueVals = Array.from(new Set(vals.filter(Boolean)));
      setColorByField(colorByField, uniqueVals, vals);
    }
  }, [colorByField, records, setColorByField, setMatchKeyColumn]);

  const onChangeLabelField = useCallback((fields: string[]) => {
    setSelectedLabelFields(fields);
  }, [setSelectedLabelFields]);

  const matchKeyColumnOptions = useMemo<AutoCompleteOption<string>[]>(() => columns.map(col => {
    const count = columnMatchCounts[col];
    const matchText =
      totalTaxa > 0 && count !== undefined
        ? ` (${count}/${totalTaxa} matches)`
        : '';

    return {
      label: col,
      secondaryLabel: matchText || undefined,
      value: col,
    };
  }), [columnMatchCounts, columns, totalTaxa]);

  const colorByFieldOptions = useMemo<AutoCompleteOption<string>[]>(() => columns.map(col => ({
    label: col,
    value: col,
  })), [columns]);

  const labelFieldOptions = useMemo<AutoCompleteOption<string>[]>(() => columns.filter((col) => col !== matchKeyColumn).map(col => ({
    label: col,
    value: col,
  })), [columns, matchKeyColumn]);

  const formFieldDefinitions = useMemo<FormFieldDefinition<FormFields>[]>(() => [
    {
      contentAfter: (
        <>
          {matchKeyColumn && totalTaxa > 0 && columnMatchCounts[matchKeyColumn] !== undefined && (
            <Box sx={{ marginBottom: 2, marginTop: 1 }}>
              <StatusChip
                hasWarning={columnMatchCounts[matchKeyColumn] === 0}
                label={`${columnMatchCounts[matchKeyColumn]}/${totalTaxa} sequences matched`}
              />
            </Box>
          )}
        </>
      ),
      definition: FORM_FIELD_DEFINITION_TYPE.SELECT,
      label: 'Sequence ID matching column',
      name: 'matchKeyColumn',
      onChange: onChangeMatchKey,
      options: matchKeyColumnOptions,
    } as const satisfies FormFieldDefinition<FormFields>,
    {
      definition: FORM_FIELD_DEFINITION_TYPE.AUTOCOMPLETE,
      label: 'Color field',
      name: 'colorByField',
      onChange: onChangeColorBy,
      options: colorByFieldOptions,
    } as const satisfies FormFieldDefinition<FormFields>,
    {
      contentAfter: (
        <Typography
          color={'text.secondary'}
          variant={'caption'}
        >
          {'Format: '}
          <code>
            {matchKeyColumn || 'ID'}
            {selectedLabelFields.length > 0 ? ` | ${selectedLabelFields.join(' | ')}` : ''}
          </code>
        </Typography>

      ),
      definition: FORM_FIELD_DEFINITION_TYPE.AUTOCOMPLETE,
      hideSelectAll: true,
      label: 'Label fields',
      multiple: true,
      name: 'selectedLabelFields',
      onChange: onChangeLabelField,
      options: labelFieldOptions,
    } as const satisfies FormFieldDefinition<FormFields>,
  ] as const, [matchKeyColumn, totalTaxa, columnMatchCounts, onChangeMatchKey, matchKeyColumnOptions, onChangeColorBy, colorByFieldOptions, selectedLabelFields, onChangeLabelField, labelFieldOptions]);

  const values = useMemo<FormFields>(() => FormUtil.createFormValues(formFieldDefinitions, {
    colorByField,
    matchKeyColumn,
    selectedLabelFields,
  }), [formFieldDefinitions, matchKeyColumn, colorByField, selectedLabelFields]);

  const formMethods = useForm<FormFields>({
    values,
  });
  const { handleSubmit } = formMethods;

  const onFormSubmit = useCallback((_formValues: FormFields) => {
    // do nothing
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <GenericForm<FormFields>
        formFieldDefinitions={formFieldDefinitions}
        formId={formId}
        formMethods={formMethods}
        onSubmit={handleSubmit(onFormSubmit)}
      />
    </Box>
  );
};
