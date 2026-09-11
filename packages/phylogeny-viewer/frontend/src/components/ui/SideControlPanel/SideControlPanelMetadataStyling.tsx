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

import { uiStore } from '../../../stores/uiStore';
import { StatusChip } from '../StatusChip';

type FormFields = {
  colorByField?: string;
  matchKeyField?: string;
  selectedLabelFields?: string[];
};

export const SideControlPanelMetadataStyling = () => {
  const formId = useId();
  const parsedMetadata = useStore(uiStore, (state) => state.parsedMetadata);
  const parsedFasta = useStore(uiStore, (state) => state.parsedFasta);

  const matchKeyField = useStore(uiStore, (state) => state.matchKeyField);
  const setMatchKeyField = useStore(uiStore, (state) => state.setMatchKeyField);
  const columnMatchCounts = useStore(uiStore, (state) => state.columnMatchCounts);

  const colorByField = useStore(uiStore, (state) => state.colorByField);
  const setColorByField = useStore(uiStore, (state) => state.setColorByField);
  const selectedLabelFields = useStore(uiStore, (state) => state.selectedLabelFields);
  const setSelectedLabelFields = useStore(uiStore, (state) => state.setSelectedLabelFields);

  const columns = useMemo(() => parsedMetadata?.columns || [], [parsedMetadata]);

  const totalTaxa = parsedFasta?.sequences?.length || 0;

  const onChangeColorBy = useCallback((field: string) => {
    setColorByField(field);
  }, [setColorByField]);

  const onChangeMatchKey = useCallback((col: string) => {
    setMatchKeyField(col);
  }, [setMatchKeyField]);

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

  const labelFieldOptions = useMemo<AutoCompleteOption<string>[]>(() => columns.filter((col) => col !== matchKeyField).map(col => ({
    label: col,
    value: col,
  })), [columns, matchKeyField]);

  const formFieldDefinitions = useMemo<FormFieldDefinition<FormFields>[]>(() => [
    {
      contentAfter: (
        <>
          {matchKeyField && totalTaxa > 0 && columnMatchCounts[matchKeyField] !== undefined && (
            <Box sx={{ marginBottom: 2, marginTop: 1 }}>
              <StatusChip
                hasWarning={columnMatchCounts[matchKeyField] === 0}
                label={`${columnMatchCounts[matchKeyField]}/${totalTaxa} sequences matched`}
              />
            </Box>
          )}
        </>
      ),
      definition: FORM_FIELD_DEFINITION_TYPE.SELECT,
      label: 'Sequence ID matching column',
      name: 'matchKeyField',
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
            {matchKeyField || 'ID'}
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
  ] as const, [matchKeyField, totalTaxa, columnMatchCounts, onChangeMatchKey, matchKeyColumnOptions, onChangeColorBy, colorByFieldOptions, selectedLabelFields, onChangeLabelField, labelFieldOptions]);

  const values = useMemo<FormFields>(() => FormUtil.createFormValues(formFieldDefinitions, {
    colorByField,
    matchKeyField,
    selectedLabelFields,
  }), [formFieldDefinitions, matchKeyField, colorByField, selectedLabelFields]);

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
