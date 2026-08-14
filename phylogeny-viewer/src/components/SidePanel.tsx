import Drawer from "@mui/material/Drawer";
import Toolbar from "@mui/material/Toolbar";
import Box from "@mui/material/Box";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CalculateIcon from "@mui/icons-material/Calculate";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PaletteIcon from "@mui/icons-material/Palette";
import SearchIcon from "@mui/icons-material/Search";

const DRAWER_WIDTH = 320;

interface SidePanelProps {
  open: boolean;
}

/**
 * Side control panel (structural zone).
 *
 * A static drawer housing organized accordion sections for data loading,
 * calculation settings, view & layout, metadata & styling, and search.
 * All controls are non-functional placeholders for now.
 */
export default function SidePanel({ open }: SidePanelProps) {
  return (
    <Drawer
      variant="persistent"
      anchor="left"
      open={open}
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: DRAWER_WIDTH,
          boxSizing: "border-box",
        },
      }}
    >
      <Toolbar />
      <Box sx={{ overflow: "auto" }}>
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <UploadFileIcon sx={{ mr: 1 }} />
            <Typography>Data</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary">
              Load FASTA sequences and TSV metadata.
            </Typography>
            {/* TODO: data loading controls */}
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <CalculateIcon sx={{ mr: 1 }} />
            <Typography>Tree Calculation</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary">
              Engine selector (TN93 vs FastTree) and ML parameters.
            </Typography>
            {/* TODO: calculation settings */}
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <VisibilityIcon sx={{ mr: 1 }} />
            <Typography>View &amp; Layout</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary">
              Layout switcher and visual toggles.
            </Typography>
            {/* TODO: view & layout controls */}
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <PaletteIcon sx={{ mr: 1 }} />
            <Typography>Metadata &amp; Styling</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary">
              Color-by attribute, legend, and leaf label builder.
            </Typography>
            {/* TODO: metadata & styling controls */}
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <SearchIcon sx={{ mr: 1 }} />
            <Typography>Search &amp; Filter</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary">
              Free-text search and highlight options.
            </Typography>
            {/* TODO: search controls */}
          </AccordionDetails>
        </Accordion>
      </Box>
    </Drawer>
  );
}
