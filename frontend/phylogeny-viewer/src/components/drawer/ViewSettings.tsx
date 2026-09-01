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
import LinearScaleIcon from '@mui/icons-material/LinearScale';

import { useTreeViewStore } from '../../stores/treeViewStore';

export const ViewSettings = () => {
  const showBranchLengths = useTreeViewStore((state) => state.showBranchLengths);
  const setShowBranchLengths = useTreeViewStore((state) => state.setShowBranchLengths);
  const showLeafLabels = useTreeViewStore((state) => state.showLeafLabels);
  const setShowLeafLabels = useTreeViewStore((state) => state.setShowLeafLabels);
  const showSupportLines = useTreeViewStore((state) => state.showSupportLines);
  const setShowSupportLines = useTreeViewStore((state) => state.setShowSupportLines);
  const showScaleBar = useTreeViewStore((state) => state.showScaleBar);
  const setShowScaleBar = useTreeViewStore((state) => state.setShowScaleBar);

  const onChangeLeafLabels = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setShowLeafLabels(event.target.checked);
  }, [setShowLeafLabels]);
  const onChangeBranchLengths = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setShowBranchLengths(event.target.checked);
  }, [setShowBranchLengths]);
  const onChangeScaleBar = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setShowScaleBar(event.target.checked);
  }, [setShowScaleBar]);
  const onChangeSupportLines = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setShowSupportLines(event.target.checked);
  }, [setShowSupportLines]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography
        color={'text.secondary'}
        sx={{ fontWeight: 700 }}
        variant={'caption'}
      >
        {'Visual Toggles:'}
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
                {'Show Leaf Labels'}
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
                {'Show Branch Lengths'}
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
                {'Show Distance Scale Bar'}
              </Typography>
            </Box>
          )}
        />
        <FormControlLabel
          control={(
            <Switch
              checked={showSupportLines}
              onChange={onChangeSupportLines}
              size={'small'}
            />
          )}
          label={(
            <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
              <LinearScaleIcon
                color={'action'}
                fontSize={'small'}
              />
              <Typography variant={'body2'}>
                {'Show Leaf Guide Lines'}
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
