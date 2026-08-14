import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

/**
 * Primary viewport / tree canvas (structural zone).
 *
 * A 100% width/height responsive zone that will eventually render the
 * interactive phylogenetic tree via gen-epix-ui. For now it is an empty
 * placeholder area with no tree rendering.
 */
export default function TreeCanvas() {
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        color: "text.disabled",
        userSelect: "none",
      }}
    >
      <Typography variant="body1">
        Tree canvas — no data loaded
      </Typography>
    </Box>
  );
}
