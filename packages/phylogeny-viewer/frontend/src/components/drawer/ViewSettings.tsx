import {
  useCallback,
  useId,
  useMemo,
} from 'react';
import {
  Box,
  Typography,
} from '@mui/material';
import StraightenIcon from '@mui/icons-material/Straighten';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import { useStore } from 'zustand';
import { GenericForm } from '@gen-epix/ui-core-form/components/helpers/GenericForm';
import type { FormFieldDefinition } from '@gen-epix/ui-core-form/models/form';
import { FORM_FIELD_DEFINITION_TYPE } from '@gen-epix/ui-core-form/models/form';
import { FormUtil } from '@gen-epix/ui-core-form/utils/FormUtil';
import { useForm } from 'react-hook-form';

import { treeViewStore } from '../../stores/treeViewStore';

type FormFields = {
  showBranchLengths?: boolean;
  showLeafLabels?: boolean;
  showScaleBar?: boolean;
};

export const ViewSettings = () => {
  const formId = useId();
  const showBranchLengths = useStore(treeViewStore, (state) => state.showBranchLengths);
  const setShowBranchLengths = useStore(treeViewStore, (state) => state.setShowBranchLengths);
  const showLeafLabels = useStore(treeViewStore, (state) => state.showLeafLabels);
  const setShowLeafLabels = useStore(treeViewStore, (state) => state.setShowLeafLabels);
  const showScaleBar = useStore(treeViewStore, (state) => state.showScaleBar);
  const setShowScaleBar = useStore(treeViewStore, (state) => state.setShowScaleBar);

  const onChangeLeafLabels = useCallback((value: boolean) => {
    setShowLeafLabels(value);
  }, [setShowLeafLabels]);
  const onChangeBranchLengths = useCallback((value: boolean) => {
    setShowBranchLengths(value);
  }, [setShowBranchLengths]);
  const onChangeScaleBar = useCallback((value: boolean) => {
    setShowScaleBar(value);
  }, [setShowScaleBar]);

  const formFieldDefinitions = useMemo<FormFieldDefinition<FormFields>[]>(() => [
    {
      definition: FORM_FIELD_DEFINITION_TYPE.SWITCH,
      icon: <LabelOutlinedIcon />,
      label: 'Show leaf labels',
      name: 'showLeafLabels',
      onChange: onChangeLeafLabels,
    } as const satisfies FormFieldDefinition<FormFields>,
    {
      definition: FORM_FIELD_DEFINITION_TYPE.SWITCH,
      icon: <AccountTreeOutlinedIcon />,
      label: 'Show branch lengths',
      name: 'showBranchLengths',
      onChange: onChangeBranchLengths,
    } as const satisfies FormFieldDefinition<FormFields>,
    {
      definition: FORM_FIELD_DEFINITION_TYPE.SWITCH,
      icon: <StraightenIcon />,
      label: 'Show scale bar',
      name: 'showScaleBar',
      onChange: onChangeScaleBar,
    } as const satisfies FormFieldDefinition<FormFields>,


  ] as const, [onChangeBranchLengths, onChangeLeafLabels, onChangeScaleBar]);

  const values = useMemo<FormFields>(() => FormUtil.createFormValues(formFieldDefinitions, {
    showBranchLengths,
    showLeafLabels,
    showScaleBar,
  }), [formFieldDefinitions, showBranchLengths, showLeafLabels, showScaleBar]);

  const formMethods = useForm<FormFields>({
    values,
  });
  const { handleSubmit } = formMethods;

  const onFormSubmit = useCallback((_formValues: FormFields) => {
    // do nothing
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography
        color={'text.secondary'}
        sx={{ fontWeight: 700 }}
        variant={'caption'}
      >
        {'Visual Toggles'}
      </Typography>
      <GenericForm<FormFields>
        formFieldDefinitions={formFieldDefinitions}
        formId={formId}
        formMethods={formMethods}
        onSubmit={handleSubmit(onFormSubmit)}
      />
    </Box>
  );
};
