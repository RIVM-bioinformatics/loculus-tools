import type { ChangeEvent } from 'react';
import { useCallback } from 'react';
import {
  Box,
  Divider,
  FormControlLabel,
  FormGroup,
  Switch,
  Typography,
} from '@mui/material';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import StraightenIcon from '@mui/icons-material/Straighten';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import { useStore } from 'zustand';

import { treeViewStore } from '../../stores/treeViewStore';

export const ViewSettings = () => {
  const showBranchLengths = useStore(treeViewStore, (state) => state.showBranchLengths);
  const setShowBranchLengths = useStore(treeViewStore, (state) => state.setShowBranchLengths);
  const showLeafLabels = useStore(treeViewStore, (state) => state.showLeafLabels);
  const setShowLeafLabels = useStore(treeViewStore, (state) => state.setShowLeafLabels);
  const showScaleBar = useStore(treeViewStore, (state) => state.showScaleBar);
  const setShowScaleBar = useStore(treeViewStore, (state) => state.setShowScaleBar);

  const onChangeLeafLabels = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setShowLeafLabels(event.target.checked);
  }, [setShowLeafLabels]);
  const onChangeBranchLengths = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setShowBranchLengths(event.target.checked);
  }, [setShowBranchLengths]);
  const onChangeScaleBar = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setShowScaleBar(event.target.checked);
  }, [setShowScaleBar]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography
        color={'text.secondary'}
        sx={{ fontWeight: 700 }}
        variant={'caption'}
      >
        {'Visual Toggles'}
      </Typography>
      <FormGroup sx={{ gap: 1 }}>
        <FormControlLabel
          control={(
            <Switch
              checked={showLeafLabels}
              onChange={onChangeLeafLabels}
              size={'small'}
            />
          )}
          label={(
            <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
              <LabelOutlinedIcon
                color={'action'}
                fontSize={'small'}
              />
              <Typography variant={'body2'}>
                {'Show leaf labels'}
              </Typography>
            </Box>
          )}
        />
        <FormControlLabel
          control={(
            <Switch
              checked={showBranchLengths}
              onChange={onChangeBranchLengths}
              size={'small'}
            />
          )}
          label={(
            <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
              <AccountTreeOutlinedIcon
                color={'action'}
                fontSize={'small'}
              />
              <Typography variant={'body2'}>
                {'Show branch lengths'}
              </Typography>
            </Box>
          )}
        />
        <FormControlLabel
          control={(
            <Switch
              checked={showScaleBar}
              onChange={onChangeScaleBar}
              size={'small'}
            />
          )}
          label={(
            <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
              <StraightenIcon
                color={'action'}
                fontSize={'small'}
              />
              <Typography variant={'body2'}>
                {'Show distance scale bar'}
              </Typography>
            </Box>
          )}
        />
      </FormGroup>
      <Divider sx={{ my: 0.5 }} />
      <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
        <VisibilityOutlinedIcon
          color={'action'}
          fontSize={'small'}
        />
        <Typography
          color={'text.secondary'}
          variant={'caption'}
        >
          {'Layout: '}
          <strong>
            {'Rectangular'}
          </strong>
        </Typography>
      </Box>
    </Box>
  );
};
