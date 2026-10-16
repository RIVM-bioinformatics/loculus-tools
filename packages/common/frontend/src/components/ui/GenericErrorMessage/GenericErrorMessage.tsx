import {
  Box,
  Typography,
} from '@mui/material';
import { t } from 'i18next';

export type GenericErrorMessageProps = {
  error: unknown;
};

export const GenericErrorMessage = ({ error }: GenericErrorMessageProps) => {
  return (
    <Box
      sx={{
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        width: '100%',
      }}
    >
      <Box sx={{ padding: 1 }}>
        <Typography
          variant={'h1'}
        >
          {t`Something went wrong`}
        </Typography>
      </Box>
      <Box sx={{ padding: 1 }}>
        <Typography
          variant={'body2'}
        >
          {error instanceof Error ? error.message : t`An unexpected error occurred.`}
        </Typography>
      </Box>
      <Box sx={{ padding: 1 }}>
        <Typography variant={'h6'}>
          {t`Details for our technicians`}
        </Typography>
        <Box
          component={'pre'}
          sx={{
            fontSize: '0.8rem',
          }}
        >
          {(error as Error)?.stack}
        </Box>
      </Box>
    </Box>
  );
};
