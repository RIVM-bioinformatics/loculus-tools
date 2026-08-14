import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import TextField from "@mui/material/TextField";
import { useState } from "react";

interface DataImportDialogProps {
  open: boolean;
  onClose: () => void;
}

type InputMethod = "dropzone" | "url" | "paste";

/**
 * Data import dialog (centered overlay).
 *
 * Features two groups side by side for FASTA and Metadata (TSV) data, each
 * with tabbed input methods (drag-and-drop, URL, copy-paste). All inputs are
 * non-functional placeholders for now.
 */
export default function DataImportDialog({ open, onClose }: DataImportDialogProps) {
  const [fastaMethod, setFastaMethod] = useState<InputMethod>("dropzone");
  const [metadataMethod, setMetadataMethod] = useState<InputMethod>("dropzone");

  const renderInputGroup = (
    title: string,
    method: InputMethod,
    onMethodChange: (m: InputMethod) => void
  ) => (
    <Box>
      <Typography variant="subtitle1" gutterBottom>
        {title}
      </Typography>
      <Tabs
        value={method}
        onChange={(_e, v: InputMethod) => onMethodChange(v)}
        variant="fullWidth"
      >
        <Tab label="Drop" value="dropzone" />
        <Tab label="URL" value="url" />
        <Tab label="Paste" value="paste" />
      </Tabs>
      <Box sx={{ mt: 2 }}>
        {method === "dropzone" && (
          <Box
            sx={{
              border: "2px dashed",
              borderColor: "divider",
              borderRadius: 1,
              p: 4,
              textAlign: "center",
              color: "text.secondary",
            }}
          >
            <Typography variant="body2">Place your file(s) here</Typography>
            {/* TODO: drag-and-drop handling */}
          </Box>
        )}
        {method === "url" && (
          <TextField
            fullWidth
            size="small"
            label="Public URL"
            placeholder="https://…"
            disabled
          />
        )}
        {method === "paste" && (
          <TextField
            fullWidth
            size="small"
            multiline
            minRows={4}
            label="Paste content"
            disabled
          />
        )}
      </Box>
    </Box>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Import Data</DialogTitle>
      <DialogContent>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            {renderInputGroup("FASTA", fastaMethod, setFastaMethod)}
          </Grid>
          <Grid item xs={12} md={6}>
            {renderInputGroup("Metadata (TSV)", metadataMethod, setMetadataMethod)}
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onClose} variant="contained" disabled>
          Load Data
        </Button>
      </DialogActions>
    </Dialog>
  );
}
