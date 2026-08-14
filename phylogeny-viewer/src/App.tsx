import { useState } from "react";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import TopNavBar from "./components/TopNavBar";
import SidePanel from "./components/SidePanel";
import TreeCanvas from "./components/TreeCanvas";
import DataImportDialog from "./components/DataImportDialog";
import { useBiowasm } from "./hooks/useBiowasm";

/**
 * Application shell.
 *
 * Composes the primary structural zones:
 *   1. Top navigation bar (AppBar)
 *   2. Side control panel (Drawer)
 *   3. Primary viewport (tree canvas)
 *   4. Centered data import dialog
 *
 * Biowasm preloading is kicked off on mount via useBiowasm.
 */
export default function App() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const biowasm = useBiowasm();

  return (
    <Box sx={{ display: "flex", height: "100vh", width: "100vw" }}>
      <TopNavBar
        onToggleDrawer={() => setDrawerOpen((open) => !open)}
        onOpenImport={() => setImportOpen(true)}
        biowasm={biowasm}
      />

      <SidePanel open={drawerOpen} />

      <Box component="main" sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
        <Toolbar />
        <Box sx={{ flexGrow: 1, minHeight: 0 }}>
          <TreeCanvas />
        </Box>
      </Box>

      <DataImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </Box>
  );
}
