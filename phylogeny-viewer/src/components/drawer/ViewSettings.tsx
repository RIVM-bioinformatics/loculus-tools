import React from 'react';
import {
  Box,
  Typography,
  FormGroup,
  FormControlLabel,
  Switch,
  Divider,
} from '@mui/material';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import StraightenIcon from '@mui/icons-material/Straighten';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import LinearScaleIcon from '@mui/icons-material/LinearScale';
import { useTreeViewStore } from '../../stores/treeViewStore';

export const ViewSettings: React.FC = () => {
  const showBranchLengths = useTreeViewStore((state) => state.showBranchLengths);
  const setShowBranchLengths = useTreeViewStore((state) => state.setShowBranchLengths);
  const showLeafLabels = useTreeViewStore((state) => state.showLeafLabels);
  const setShowLeafLabels = useTreeViewStore((state) => state.setShowLeafLabels);
  const showSupportLines = useTreeViewStore((state) => state.showSupportLines);
  const setShowSupportLines = useTreeViewStore((state) => state.setShowSupportLines);
  const showScaleBar = useTreeViewStore((state) => state.showScaleBar);
  const setShowScaleBar = useTreeViewStore((state) => state.setShowScaleBar);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
        Visual Toggles:
      </Typography>

      <FormGroup sx={{ gap: 1 }}>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={showLeafLabels}
              onChange={(e) => setShowLeafLabels(e.target.checked)}
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LabelOutlinedIcon fontSize="small" color="action" />
              <Typography variant="body2">Show Leaf Labels</Typography>
            </Box>
          }
        />

        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={showBranchLengths}
              onChange={(e) => setShowBranchLengths(e.target.checked)}
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccountTreeOutlinedIcon fontSize="small" color="action" />
              <Typography variant="body2">Show Branch Lengths</Typography>
            </Box>
          }
        />

        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={showScaleBar}
              onChange={(e) => setShowScaleBar(e.target.checked)}
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StraightenIcon fontSize="small" color="action" />
              <Typography variant="body2">Show Distance Scale Bar</Typography>
            </Box>
          }
        />

        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={showSupportLines}
              onChange={(e) => setShowSupportLines(e.target.checked)}
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LinearScaleIcon fontSize="small" color="action" />
              <Typography variant="body2">Show Leaf Guide Lines</Typography>
            </Box>
          }
        />
      </FormGroup>

      <Divider sx={{ my: 0.5 }} />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <VisibilityOutlinedIcon fontSize="small" color="action" />
        <Typography variant="caption" color="text.secondary">
          Layout: <strong>Rectangular</strong>
        </Typography>
      </Box>
    </Box>
  );
};
