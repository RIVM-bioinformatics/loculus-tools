import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Badge from "@mui/material/Badge";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import MenuIcon from "@mui/icons-material/Menu";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { useState } from "react";
import type { BiowasmState } from "../hooks/useBiowasm";

interface TopNavBarProps {
  onToggleDrawer: () => void;
  onOpenImport: () => void;
  biowasm: BiowasmState;
}

/**
 * Top navigation bar (structural zone).
 *
 * Contains application branding, active dataset indicators (static for now),
 * and global actions (import, export, reset). All actions are placeholders
 * except the import trigger, which opens the data import dialog.
 */
export default function TopNavBar({
  onToggleDrawer,
  onOpenImport,
  biowasm,
}: TopNavBarProps) {
  const [exportAnchor, setExportAnchor] = useState<null | HTMLElement>(null);

  const handleExportClick = (event: React.MouseEvent<HTMLElement>) => {
    setExportAnchor(event.currentTarget);
  };

  const handleExportClose = () => {
    setExportAnchor(null);
  };

  const ready = biowasm.status === "ready";
  const readyLabel = ready
    ? "ready: ✅"
    : biowasm.status === "loading"
      ? "loading…"
      : "ready: ✗";

  return (
    <AppBar position="fixed" color="primary" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar variant="dense">
        <IconButton
          edge="start"
          color="inherit"
          aria-label="toggle sidebar"
          onClick={onToggleDrawer}
          sx={{ mr: 1 }}
        >
          <MenuIcon />
        </IconButton>

        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Phylogenetic Tree Viewer
        </Typography>

        {/* Active dataset indicators (static placeholders) */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mr: 2 }}>
          <Badge color="secondary" variant="dot" invisible>
            <Chip
              size="small"
              label="0 sequences"
              variant="outlined"
              sx={{ color: "inherit", borderColor: "rgba(255,255,255,0.5)" }}
            />
          </Badge>
          <Chip
            size="small"
            label="No metadata"
            variant="outlined"
            sx={{ color: "inherit", borderColor: "rgba(255,255,255,0.5)" }}
          />
          <Tooltip title={readyLabel}>
            <Chip
              size="small"
              label={readyLabel}
              variant="outlined"
              color={ready ? "success" : "default"}
              sx={{ color: "inherit", borderColor: "rgba(255,255,255,0.5)" }}
            />
          </Tooltip>
        </Box>

        {/* Global actions */}
        <Tooltip title="Import data">
          <IconButton color="inherit" aria-label="import data" onClick={onOpenImport}>
            <UploadFileIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title="Export">
          <IconButton color="inherit" aria-label="export" onClick={handleExportClick}>
            <FileDownloadIcon />
          </IconButton>
        </Tooltip>
        <Menu
          anchorEl={exportAnchor}
          open={Boolean(exportAnchor)}
          onClose={handleExportClose}
        >
          <MenuItem onClick={handleExportClose} disabled>
            Newick
          </MenuItem>
          <MenuItem onClick={handleExportClose} disabled>
            SVG
          </MenuItem>
          <MenuItem onClick={handleExportClose} disabled>
            PNG
          </MenuItem>
        </Menu>

        <Tooltip title="Reset session">
          <Button
            color="inherit"
            startIcon={<RestartAltIcon />}
            onClick={() => {
              /* TODO: reset session */
            }}
            disabled
          >
            Reset
          </Button>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
}
