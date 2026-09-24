import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Drawer,
  IconButton,
  Snackbar,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardArrowDownOutlinedIcon from '@mui/icons-material/KeyboardArrowDownOutlined';
import KeyboardArrowLeftOutlinedIcon from '@mui/icons-material/KeyboardArrowLeftOutlined';
import KeyboardArrowRightOutlinedIcon from '@mui/icons-material/KeyboardArrowRightOutlined';
import KeyboardArrowUpOutlinedIcon from '@mui/icons-material/KeyboardArrowUpOutlined';
import DeleteSweepOutlinedIcon from '@mui/icons-material/DeleteSweepOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import RedoOutlinedIcon from '@mui/icons-material/RedoOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined';

import { MATRIX_TYPE } from '../../models';
import type { SearchMatch } from '../../models';
import { createEngineWorker } from '../../workers';
import { useSequenceEditor } from '../../hooks/useSequenceEditor';
import { AlignmentGrid } from '../editor/AlignmentGrid';
import { DataImportDialog } from '../dialogs/DataImportDialog';
import { ColorSettingsPanel } from '../ui/ColorSettingsPanel';
import { SearchBar } from '../ui/SearchBar';
import { wrapSearchIndex } from '../../utils/search';

import { EmptyWorkspace } from './EmptyWorkspace';
import { FastaUtil } from '../../utils/FastaUtil';

const DRAWER_WIDTH = 296;

export const MainPage = () => {
  const engine = useMemo(() => createEngineWorker(), []);
  const editor = useSequenceEditor(engine);
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
  const { state } = editor;
  const metadata = state.metadata;
  const hasAlignment = Boolean(metadata && metadata.sequences > 0);
  const initialFastaUrl = FastaUtil.fastaUrlFromSearch(window.location.search);
  const autoLoadUrlStartedRef = useRef(false);

  useEffect(() => {
    if (!initialFastaUrl || !engine.ready || autoLoadUrlStartedRef.current) {
      return;
    }
    autoLoadUrlStartedRef.current = true;
    editor.setDialog('import');
  }, [editor, engine.ready, initialFastaUrl]);

  const onLoad = useCallback(async (fasta: string, label: string): Promise<boolean> => {
    try {
      await editor.loadFasta(fasta, label);
      editor.setDialog('none');
      return true;
    } catch {
      return false;
    }
  }, [editor]);

  const onOpenImport = useCallback(() => {
    editor.setDialog('import');
  }, [editor]);

  const onCloseImport = useCallback(() => {
    editor.setDialog('none');
  }, [editor]);

  const onRetry = useCallback(() => {
    window.location.reload();
  }, []);

  const onClickExport = useCallback(() => {
    void editor.exportFasta();
  }, [editor]);

  const onClickUndo = useCallback(() => {
    void editor.undo();
  }, [editor]);

  const onClickRedo = useCallback(() => {
    void editor.redo();
  }, [editor]);

  const focusSearchHit = useCallback((hit: SearchMatch) => {
    const isRecordName = hit.matrix_type === MATRIX_TYPE.RECORD_NAME;
    editor.setActiveCell(hit.row, isRecordName ? 0 : hit.col);
    editor.setSelectionBlock(null);
    editor.setSelectionAnchorRow(hit.row);
    editor.setSelectedRows(isRecordName ? [hit.row] : []);
  }, [editor]);

  const onSearch = useCallback(async (query: string, includeRecordNames: boolean) => {
    const results = await editor.search(query, includeRecordNames);
    const firstHit = results?.positions[0];
    if (firstHit) {
      focusSearchHit(firstHit);
    }
    return results;
  }, [editor, focusSearchHit]);

  const onNavigateSearch = useCallback((change: number) => {
    const results = state.searchResults;
    if (!results || results.positions.length === 0) {
      return;
    }
    const nextHit = wrapSearchIndex(state.currentHit, change, results.positions.length);
    const hit = results.positions[nextHit];
    editor.setCurrentHit(nextHit);
    if (hit) {
      focusSearchHit(hit);
    }
  }, [editor, focusSearchHit, state.currentHit, state.searchResults]);

  const onMoveHorizontal = useCallback((direction: 'left' | 'right') => {
    void editor.executeCommand({ direction, type: 'moveHorizontal' });
  }, [editor]);

  const onMoveHorizontalLeft = useCallback(() => {
    onMoveHorizontal('left');
  }, [onMoveHorizontal]);

  const onMoveHorizontalRight = useCallback(() => {
    onMoveHorizontal('right');
  }, [onMoveHorizontal]);

  const onMoveRows = useCallback((direction: 'down' | 'up') => {
    const rows = state.selectedRows.length > 0 ? state.selectedRows : [state.activeCell.row];
    void (direction === 'up' ? editor.moveRowsUp(rows) : editor.moveRowsDown(rows));
  }, [editor, state.activeCell.row, state.selectedRows]);

  const onMoveRowsUp = useCallback(() => {
    onMoveRows('up');
  }, [onMoveRows]);

  const onMoveRowsDown = useCallback(() => {
    onMoveRows('down');
  }, [onMoveRows]);

  const onGridActiveCell = useCallback((cell: { col: number; row: number }) => {
    editor.setActiveCell(cell.row, cell.col);
  }, [editor]);

  const onDeleteColumn = useCallback(() => {
    if (!metadata || !window.confirm(`Delete alignment column ${state.activeCell.col + 1}?`)) {
      return;
    }
    void editor.deleteColumn(state.activeCell.col);
  }, [editor, metadata, state.activeCell.col]);

  const showSettings = state.openPanel === 'settings';
  const onToggleSettings = useCallback(() => {
    editor.setPanel(showSettings ? 'none' : 'settings');
  }, [editor, showSettings]);

  const onCloseSettings = useCallback(() => {
    editor.setPanel('none');
  }, [editor]);

  const onClickCloseSettings = useCallback(() => {
    editor.setPanel('none');
  }, [editor]);

  const onCloseStatus = useCallback(() => {
    editor.setStatus(null);
  }, [editor]);

  return (
    <Box sx={{ bgcolor: '#f4f6f8', display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, overflow: 'hidden' }}>
      <AppBar
        elevation={1}
        position={'static'}
        sx={{ zIndex: (currentTheme) => currentTheme.zIndex.drawer + 1 }}
      >
        <Toolbar
          sx={{ gap: 1, minHeight: 56, px: { sm: 2, xs: 1 } }}
          variant={'dense'}
        >
          <BiotechOutlinedIcon sx={{ display: { sm: 'block', xs: 'none' } }} />
          <Box sx={{ minWidth: 0, mr: 'auto' }}>
            <Typography
              noWrap
              sx={{ color: 'inherit', fontWeight: 700, lineHeight: 1.2 }}
              variant={'h6'}
            >
              {'MindTheGap'}
            </Typography>
            <Typography
              noWrap
              sx={{ color: 'rgba(255,255,255,0.78)', fontSize: '0.72rem' }}
            >
              {state.datasetLabel}
              {metadata && ` · ${metadata.sequences} sequences × ${metadata.width} bases`}
            </Typography>
          </Box>
          <Chip
            color={engine.ready ? 'success' : 'warning'}
            label={engine.ready ? 'Ready' : 'Loading'}
            size={'small'}
            sx={{ display: { sm: 'inline-flex', xs: 'none' } }}
          />
          <Button
            color={'inherit'}
            disabled={state.busy || !engine.ready}
            onClick={onOpenImport}
            size={'small'}
            startIcon={<FileUploadOutlinedIcon />}
            sx={{ display: { sm: 'inline-flex', xs: 'none' } }}
            variant={'text'}
          >
            {'Import'}
          </Button>
          <Tooltip title={'Import FASTA'}>
            <span>
              <IconButton
                aria-label={'Import FASTA'}
                color={'inherit'}
                disabled={state.busy || !engine.ready}
                onClick={onOpenImport}
                size={'small'}
                sx={{ display: { sm: 'none', xs: 'inline-flex' } }}
              >
                <FileUploadOutlinedIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Button
            color={'inherit'}
            disabled={state.busy || !hasAlignment}
            onClick={onClickExport}
            size={'small'}
            startIcon={<FileDownloadOutlinedIcon />}
            sx={{ display: { sm: 'inline-flex', xs: 'none' } }}
            variant={'text'}
          >
            {'Export'}
          </Button>
          <Tooltip title={'Export FASTA'}>
            <span>
              <IconButton
                aria-label={'Export FASTA'}
                color={'inherit'}
                disabled={state.busy || !hasAlignment}
                onClick={onClickExport}
                size={'small'}
                sx={{ display: { sm: 'none', xs: 'inline-flex' } }}
              >
                <FileDownloadOutlinedIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={'Undo'}>
            <span>
              <IconButton
                aria-label={'Undo'}
                color={'inherit'}
                disabled={state.busy || !hasAlignment || metadata?.undoDepth === 0}
                onClick={onClickUndo}
                size={'small'}
              >
                <UndoOutlinedIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={'Redo'}>
            <span>
              <IconButton
                aria-label={'Redo'}
                color={'inherit'}
                disabled={state.busy || !hasAlignment || metadata?.redoDepth === 0}
                onClick={onClickRedo}
                size={'small'}
              >
                <RedoOutlinedIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={'Move selected block left'}>
            <span>
              <IconButton
                aria-label={'Move selected block left'}
                color={'inherit'}
                disabled={state.busy || !hasAlignment}
                onClick={onMoveHorizontalLeft}
                size={'small'}
              >
                <KeyboardArrowLeftOutlinedIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={'Move selected block right'}>
            <span>
              <IconButton
                aria-label={'Move selected block right'}
                color={'inherit'}
                disabled={state.busy || !hasAlignment}
                onClick={onMoveHorizontalRight}
                size={'small'}
              >
                <KeyboardArrowRightOutlinedIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={'Settings'}>
            <IconButton
              aria-label={'Settings'}
              color={'inherit'}
              onClick={onToggleSettings}
              size={'small'}
            >
              <SettingsOutlinedIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <Box
        sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', px: { sm: 2, xs: 1 }, py: 0.75 }}
      >
        <SearchBar
          currentHit={state.currentHit}
          disabled={state.busy || !engine.ready || !hasAlignment}
          onNavigate={onNavigateSearch}
          onSearch={onSearch}
          results={state.searchResults}
        />
      </Box>
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
        <Box
          component={'main'}
          sx={{ display: 'flex', flex: 1, flexDirection: 'column', minWidth: 0, position: 'relative' }}
        >
          {state.error && engine.ready && (
            <Alert
              onClose={editor.clearError}
              severity={'error'}
              sx={{ borderRadius: 0 }}
            >
              {state.error}
            </Alert>
          )}
          {!engine.ready && !engine.error && (
            <Box sx={{ alignItems: 'center', display: 'flex', flex: 1, flexDirection: 'column', gap: 2, justifyContent: 'center' }}>
              <CircularProgress />
              <Typography color={'text.secondary'}>
                {'Initializing the alignment engine'}
              </Typography>
            </Box>
          )}
          {!engine.ready && engine.error && (
            <Box sx={{ alignItems: 'center', display: 'flex', flex: 1, flexDirection: 'column', gap: 2, justifyContent: 'center', p: 3, textAlign: 'center' }}>
              <Alert severity={'error'}>
                {engine.error}
              </Alert>
              <Button onClick={onRetry}>
                {' '}
                {'Retry'}
                {' '}
              </Button>
            </Box>
          )}
          {engine.ready && !hasAlignment && <EmptyWorkspace onImport={onOpenImport} />}
          {engine.ready && hasAlignment && metadata && (
            <Box sx={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0, overflow: 'hidden', p: { sm: 2, xs: 1 } }}>
              <AlignmentGrid
                activeCell={state.activeCell}
                busy={state.busy}
                cellFocused={state.cellFocused}
                currentHit={state.currentHit}
                dataRevision={state.dataRevision}
                datasetRevision={state.datasetRevision}
                eng={engine}
                meta={metadata}
                onActiveCell={onGridActiveCell}
                onCellFocused={editor.setCellFocused}
                onExecuteCommand={editor.executeCommand}
                onSelectedRows={editor.setSelectedRows}
                onSelectionAnchorRow={editor.setSelectionAnchorRow}
                onSelectionBlock={editor.setSelectionBlock}
                palette={state.palette}
                searchResults={state.searchResults}
                selectedRows={state.selectedRows}
                selectionAnchorRow={state.selectionAnchorRow}
                selectionBlock={state.selectionBlock}
              />
            </Box>
          )}
          <Box
            aria-live={'polite'}
            sx={{
              alignItems: 'center',
              bgcolor: '#e8edf2',
              borderColor: 'divider',
              borderTop: '1px solid',
              display: 'flex',
              gap: 2,
              minHeight: 30,
              px: 1.5,
            }}
          >
            <Typography
              color={'text.secondary'}
              noWrap
              sx={{ flex: 1, fontSize: '0.75rem' }}
            >
              {state.status ?? (state.announcement || 'Ready')}
            </Typography>
            {state.dirty && (
              <Chip
                label={'Unsaved changes'}
                size={'small'}
              />
            )}
            <Typography
              color={'text.secondary'}
              sx={{ display: { sm: 'block', xs: 'none' }, fontSize: '0.72rem' }}
            >
              {engine.ready ? 'Engine ready' : 'Engine loading'}
            </Typography>
          </Box>
        </Box>
        <Drawer
          anchor={'right'}
          onClose={onCloseSettings}
          open={showSettings}
          sx={{
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              height: '100%',
              position: 'absolute',
              width: DRAWER_WIDTH,
            },
            bottom: 0,
            position: isSmallScreen ? 'fixed' : 'absolute',
            right: 0,
            top: 0,
            zIndex: theme.zIndex.drawer,
          }}
          variant={isSmallScreen ? 'temporary' : 'persistent'}
        >
          <Toolbar
            sx={{ justifyContent: 'space-between' }}
            variant={'dense'}
          >
            <Typography variant={'h6'}>
              {'Settings'}
            </Typography>
            <IconButton
              aria-label={'Close settings'}
              onClick={onClickCloseSettings}
              size={'small'}
            >
              <CloseIcon />
            </IconButton>
          </Toolbar>
          <Stack
            spacing={2}
            sx={{ p: 2 }}
          >
            <Typography variant={'subtitle2'}>
              {'Dataset'}
            </Typography>
            <Typography
              color={'text.secondary'}
              variant={'body2'}
            >
              {state.datasetLabel}
            </Typography>
            <Typography variant={'subtitle2'}>
              {'Alignment dimensions'}
            </Typography>
            <Typography
              color={'text.secondary'}
              variant={'body2'}
            >
              {metadata ? `${metadata.sequences} sequences × ${metadata.width} bases` : 'No alignment loaded'}
            </Typography>
            <Typography variant={'subtitle2'}>
              {'Engine status'}
            </Typography>
            <Typography
              color={'text.secondary'}
              variant={'body2'}
            >
              {engine.ready ? 'Ready' : 'Initializing'}
            </Typography>
            <Typography variant={'subtitle2'}>
              {'Alignment actions'}
            </Typography>
            <Stack
              direction={'row'}
              spacing={1}
            >
              <Tooltip title={'Move selected rows up'}>
                <span>
                  <IconButton
                    aria-label={'Move selected rows up'}
                    disabled={state.busy || !hasAlignment}
                    onClick={onMoveRowsUp}
                    size={'small'}
                  >
                    <KeyboardArrowUpOutlinedIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={'Move selected rows down'}>
                <span>
                  <IconButton
                    aria-label={'Move selected rows down'}
                    disabled={state.busy || !hasAlignment}
                    onClick={onMoveRowsDown}
                    size={'small'}
                  >
                    <KeyboardArrowDownOutlinedIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={'Delete active alignment column'}>
                <span>
                  <IconButton
                    aria-label={'Delete active alignment column'}
                    disabled={state.busy || !hasAlignment}
                    onClick={onDeleteColumn}
                    size={'small'}
                  >
                    <DeleteSweepOutlinedIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
            <ColorSettingsPanel
              onChange={editor.setPalette}
              onReset={editor.resetPalette}
              palette={state.palette}
            />
          </Stack>
        </Drawer>
      </Box>
      <DataImportDialog
        autoLoadUrl={Boolean(initialFastaUrl)}
        dirty={state.dirty}
        error={state.error}
        initialUrl={initialFastaUrl}
        onClose={onCloseImport}
        onLoad={onLoad}
        open={state.openDialog === 'import'}
      />
      <Snackbar
        autoHideDuration={3500}
        message={state.status ?? ''}
        onClose={onCloseStatus}
        open={Boolean(state.status)}
      />
    </Box>
  );
};
