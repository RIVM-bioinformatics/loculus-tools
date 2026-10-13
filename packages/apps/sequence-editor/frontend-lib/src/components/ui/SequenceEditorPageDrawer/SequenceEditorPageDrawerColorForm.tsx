import {
  useCallback,
  useId,
  useMemo,
} from 'react';
import { useForm } from 'react-hook-form';
import { GenericForm } from '@gen-epix/ui-core-form/components/helpers/GenericForm';
import type { FormFieldDefinition } from '@gen-epix/ui-core-form/models/form';
import { FORM_FIELD_DEFINITION_TYPE } from '@gen-epix/ui-core-form/models/form';

import type {
  AminoAcidPalette,
  NucleotidePalette,
} from '../../../models';

export type SequenceEditorPageDrawerColorFormProps<TPalette extends AminoAcidPalette | NucleotidePalette> = {
  currentPalette: TPalette;
  onPaletteChange: (palettes: TPalette) => void;
  palettes: Array<TPalette>;
};

type FormFields = {
  palette?: string;
};

export const SequenceEditorPageDrawerColorForm = <TPalette extends AminoAcidPalette | NucleotidePalette, >({ currentPalette, onPaletteChange, palettes }: SequenceEditorPageDrawerColorFormProps<TPalette>) => {
  const formId = useId();

  const onChangePalette = useCallback((paletteName: string) => {
    const palette = palettes.find((candidate) => candidate.name === paletteName);
    if (palette) {
      onPaletteChange(palette);
    }
  }, [onPaletteChange, palettes]);

  const paletteOptions = useMemo(() => palettes.map((palette) => ({
    label: palette.name,
    value: palette.name,
  })), [palettes]);

  const formFieldDefinitions = useMemo<FormFieldDefinition<FormFields>[]>(() => [
    {
      definition: FORM_FIELD_DEFINITION_TYPE.RADIO_GROUP,
      label: 'Color palette',
      name: 'palette',
      onChange: onChangePalette,
      options: paletteOptions,
      required: true,
    } as const satisfies FormFieldDefinition<FormFields>,
  ] as const, [onChangePalette, paletteOptions]);

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

  return (
    <GenericForm<FormFields>
      formFieldDefinitions={formFieldDefinitions}
      formId={formId}
      formMethods={formMethods}
      onSubmit={handleSubmit(onFormSubmit)}
    />
  );
};
