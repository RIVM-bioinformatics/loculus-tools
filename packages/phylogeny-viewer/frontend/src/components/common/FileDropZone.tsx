import type {
  ChangeEvent,
  DragEvent,
} from 'react';
import {
  useCallback,
  useRef,
  useState,
} from 'react';
import {
  Box,
  Button,
  Typography,
} from '@mui/material';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';

interface FileDropZoneProps {
  accept: string;
  file: File | null;
  helperText?: string;
  label: string;
  onFileSelected: (file: File) => void;
}

export const FileDropZone = ({
  accept,
  file,
  helperText,
  label,
  onFileSelected,
}: FileDropZoneProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelected(e.dataTransfer.files[0]);
    }
  }, [onFileSelected]);

  const onFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelected(e.target.files[0]);
    }
  }, [onFileSelected]);

  const onClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  let backgroundColor = 'background.paper';
  let borderColor = 'divider';
  if (isDragOver) {
    backgroundColor = 'action.hover';
    borderColor = 'primary.main';
  } else if (file) {
    backgroundColor = 'action.selected';
    borderColor = 'success.main';
  }

  return (
    <Box
      onClick={onClick}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      sx={{
        alignItems: 'center',
        backgroundColor,
        border: '2px dashed',
        borderColor,
        borderRadius: 2,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        justifyContent: 'center',
        minHeight: 180,
        padding: 3,
        textAlign: 'center',
        transition: 'all 0.2s ease',
      }}
    >
      <input
        accept={accept}
        onChange={onFileChange}
        ref={inputRef}
        style={{ display: 'none' }}
        type={'file'}
      />
      {file ? (
        <>
          <InsertDriveFileOutlinedIcon
            color={'success'}
            sx={{ fontSize: 40 }}
          />
          <Typography
            color={'success.main'}
            sx={{ fontWeight: 600 }}
            variant={'subtitle1'}
          >
            {file.name}
          </Typography>
          <Typography
            color={'text.secondary'}
            variant={'caption'}
          >
            {(file.size / 1024).toFixed(1)}
            {' '}
            {'KB — Click or drag to replace'}
          </Typography>
        </>
      ) : (
        <>
          <CloudUploadOutlinedIcon
            color={'primary'}
            sx={{ fontSize: 44 }}
          />
          <Typography
            sx={{ fontWeight: 600 }}
            variant={'subtitle1'}
          >
            {label}
          </Typography>
          <Typography
            color={'text.secondary'}
            variant={'body2'}
          >
            {helperText || 'Drag & drop your file here, or click to browse'}
          </Typography>
          <Button
            size={'small'}
            sx={{ mt: 1 }}
            variant={'outlined'}
          >
            {'Choose File'}
          </Button>
        </>
      )}
    </Box>
  );
};
