import {
  Box,
  CircularProgress,
  Paper,
  Typography,
} from '@mui/material';

interface LoadingOverlayProps {
  message?: string;
  subMessage?: string;
}

export const LoadingOverlay = ({
  message = 'Calculating Phylogenetic Tree...',
  subMessage,
}: LoadingOverlayProps) => {
  return (
    <Box
      sx={{
        alignItems: 'center',
        backdropFilter: 'blur(3px)',
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        bottom: 0,
        display: 'flex',
        justifyContent: 'center',
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
        zIndex: 1200,
      }}
    >
      <Paper
        elevation={4}
        sx={{
          alignItems: 'center',
          borderRadius: 3,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          maxWidth: 400,
          padding: 4,
          textAlign: 'center',
        }}
      >
        <CircularProgress
          color={'primary'}
          size={48}
          thickness={4}
        />
        <Typography
          color={'text.primary'}
          sx={{ fontWeight: 600 }}
          variant={'h6'}
        >
          {message}
        </Typography>
        {subMessage && (
          <Typography
            color={'text.secondary'}
            variant={'body2'}
          >
            {subMessage}
          </Typography>
        )}
      </Paper>
    </Box>
  );
};
