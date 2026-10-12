import {
  Box,
  Button,
  Typography,
} from '@mui/material';
import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';

export const EmptyWorkspace = ({ onImport }: { onImport: () => void }) => (
  <Box
    sx={{
      alignItems: 'center',
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
      gap: 1.5,
      justifyContent: 'center',
      p: 3,
      textAlign: 'center',
    }}
  >
    <BiotechOutlinedIcon
      sx={{ color: 'primary.main', fontSize: 64 }}
    />
    <Typography variant={'h5'}>
      {'No alignment loaded'}
    </Typography>
    <Typography
      color={'text.secondary'}
      sx={{ maxWidth: 460 }}
      variant={'body2'}
    >
      {'Import a nucleotide FASTA file or open the bundled SARS-CoV-2 demo.'}
    </Typography>
    <Button
      onClick={onImport}
      startIcon={<FileUploadOutlinedIcon />}
      sx={{ mt: 1 }}
    >
      {'Import FASTA'}
    </Button>
  </Box>
);
