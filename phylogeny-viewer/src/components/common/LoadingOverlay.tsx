import React from 'react';
import { Box, CircularProgress, Typography, Paper } from '@mui/material';

interface LoadingOverlayProps {
  message?: string;
  subMessage?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  message = 'Calculating Phylogenetic Tree...',
  subMessage,
}) => {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
      }}
    >
      <Paper
        elevation={4}
        sx={{
          padding: 4,
          borderRadius: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          maxWidth: 400,
          textAlign: 'center',
        }}
      >
        <CircularProgress size={48} thickness={4} color="primary" />
        <Typography variant="h6" color="text.primary" sx={{ fontWeight: 600 }}>
          {message}
        </Typography>
        {subMessage && (
          <Typography variant="body2" color="text.secondary">
            {subMessage}
          </Typography>
        )}
      </Paper>
    </Box>
  );
};
