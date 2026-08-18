import React, { useState, useRef } from 'react';
import { Box, Typography, Button } from '@mui/material';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';

interface FileDropZoneProps {
  label: string;
  accept: string;
  file: File | null;
  onFileSelected: (file: File) => void;
  helperText?: string;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  label,
  accept,
  file,
  onFileSelected,
  helperText,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelected(e.target.files[0]);
    }
  };

  return (
    <Box
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      sx={{
        border: '2px dashed',
        borderColor: isDragOver ? 'primary.main' : file ? 'success.main' : 'divider',
        borderRadius: 2,
        padding: 3,
        textAlign: 'center',
        cursor: 'pointer',
        backgroundColor: isDragOver ? 'action.hover' : file ? 'action.selected' : 'background.paper',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 180,
        gap: 1.5,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      {file ? (
        <>
          <InsertDriveFileOutlinedIcon color="success" sx={{ fontSize: 40 }} />
          <Typography variant="subtitle1" color="success.main" sx={{ fontWeight: 600 }}>
            {file.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {(file.size / 1024).toFixed(1)} KB — Click or drag to replace
          </Typography>
        </>
      ) : (
        <>
          <CloudUploadOutlinedIcon color="primary" sx={{ fontSize: 44 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {label}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {helperText || 'Drag & drop your file here, or click to browse'}
          </Typography>
          <Button variant="outlined" size="small" sx={{ mt: 1 }}>
            Choose File
          </Button>
        </>
      )}
    </Box>
  );
};
