import {
  Box,
  Button,
  Typography,
} from '@mui/material';

export const ErrorFallback = ({ resetErrorBoundary: onClickTryAgain }: { resetErrorBoundary: () => void }) => (
  <Box sx={{ alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 2, height: '100%', justifyContent: 'center', p: 3, textAlign: 'center' }}>
    <Typography variant={'h5'}>
      {'Sequence editor unavailable'}
    </Typography>
    <Typography color={'text.secondary'}>
      {'The editor encountered an unexpected error.'}
    </Typography>
    <Button onClick={onClickTryAgain}>
      {'Try again'}
    </Button>
  </Box>
);
