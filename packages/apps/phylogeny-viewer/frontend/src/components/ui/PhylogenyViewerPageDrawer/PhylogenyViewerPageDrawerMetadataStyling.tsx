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

import { phylogenyViewerStore } from '../../../stores/phylogenyViewerStore';
import { StatusChip } from '../StatusChip';

type FormFields = {
  colorByField?: string;
  matchKeyField?: string;
  selectedLabelFields?: string[];
};

export const PhylogenyViewerPageDrawerMetadataStyling = () => {
  const formId = useId();
  const parsedMetadata = useStore(phylogenyViewerStore, (state) => state.parsedMetadata);
  const parsedFasta = useStore(phylogenyViewerStore, (state) => state.parsedFasta);

  const matchKeyField = useStore(phylogenyViewerStore, (state) => state.matchKeyField);
  const setMatchKeyField = useStore(phylogenyViewerStore, (state) => state.setMatchKeyField);
  const columnMatchCounts = useStore(phylogenyViewerStore, (state) => state.columnMatchCounts);

  const colorByField = useStore(phylogenyViewerStore, (state) => state.colorByField);
  const setColorByField = useStore(phylogenyViewerStore, (state) => state.setColorByField);
  const selectedLabelFields = useStore(phylogenyViewerStore, (state) => state.selectedLabelFields);
  const setSelectedLabelFields = useStore(phylogenyViewerStore, (state) => state.setSelectedLabelFields);
  const columns = useMemo(() => parsedMetadata?.columns || [], [parsedMetadata]);

  const totalTaxa = parsedFasta?.sequences?.length || 0;

  const onChangeColorBy = useCallback((field: string) => {
    setColorByField(field);
  }, [setColorByField]);

  const onChangeMatchKey = useCallback((field: string) => {
    setMatchKeyField(field);
  }, [setMatchKeyField]);

  const onChangeLabelField = useCallback((fields: string[]) => {

    setSelectedLabelFields(fields);
  }, [setSelectedLabelFields]);

  const matchKeyColumnOptions = useMemo<AutoCompleteOption<string>[]>(() => {
    const options: AutoCompleteOption<string>[] = [];
    const matchCountMap = new Map<string, number>();

    columns.forEach(col => {
      const matchCount = columnMatchCounts[col];
      const matchText =
        totalTaxa > 0 && matchCount !== undefined
          ? ` (${matchCount}/${totalTaxa} matches)`
          : '';
      matchCountMap.set(col, matchCount);
      const option = {
        label: col,
        secondaryLabel: matchText || undefined,
        value: col,
      };
      options.push(option);
    });
    return options.sort((a, b) => {
      const matchCountA = matchCountMap.get(a.value) || 0;
      const matchCountB = matchCountMap.get(b.value) || 0;
      if (matchCountA !== matchCountB) {
        return matchCountB - matchCountA; // descending order
      }
      return a.label.localeCompare(b.label);
    });
  }, [columnMatchCounts, columns, totalTaxa]);

  const colorByFieldOptions = useMemo<AutoCompleteOption<string>[]>(() => {
    return columns.map(col => ({
      label: col,
      value: col,
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [columns]);

  const labelFieldOptions = useMemo<AutoCompleteOption<string>[]>(() => {
    const options: AutoCompleteOption<string>[] = columns.filter((col) => col !== matchKeyField).map(col => ({
      label: col,
      value: col,
    })).sort((a, b) => a.label.localeCompare(b.label));

    if (matchKeyField) {
      options.unshift({
        disabled: true,
        label: matchKeyField,
        value: matchKeyField,
      });
    }
    return options;
  }, [columns, matchKeyField]);

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
      disabled: !matchKeyField || !colorByFieldOptions.length,
      label: 'Color field',
      name: 'colorByField',
      onChange: onChangeColorBy,
      options: colorByFieldOptions,
    } as const satisfies FormFieldDefinition<FormFields>,
    {
      contentAfter: matchKeyField ? (
        <Typography
          color={'text.secondary'}
          variant={'caption'}
        >
          {'Format: '}
          <code>
            {selectedLabelFields.join(' | ')}
          </code>
        </Typography>
      ) : null,
      definition: FORM_FIELD_DEFINITION_TYPE.AUTOCOMPLETE,
      disabled: !matchKeyField || !labelFieldOptions.length,
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
    selectedLabelFields: [matchKeyField, ...selectedLabelFields.filter(x => x !== matchKeyField)].filter(x => !!x),
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
