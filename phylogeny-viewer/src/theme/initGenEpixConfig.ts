import { ConfigService } from '@gen-epix/ui';
import { setupTreeCanvasDrawing } from '../services/tree/patchTreeCanvas';

export function initGenEpixConfig() {
  const config = {
    dashboard: {
      ARRANGEMENT_OPTIONS: {},
      DEFAULT_ARRANGEMENT_KEY: '',
      DEFAULT_WIDGET_ASSIGNMENTS: {},
      DOWNLOAD_SECTION_ORDER: [],
      MIN_PANEL_HEIGHT: 200,
      MIN_PANEL_WIDTH: 200,
      WIDGETS: {},
    },
    epi: {
      DATA_MISSING_CHARACTER: '-',
      INITIAL_NUM_VISIBLE_ATTRIBUTES_IN_CASE_SUMMARY: 5,
      SEQDB_MAX_STORED_DISTANCE_FALLBACK: 100,
      STRATIFICATION: {
        ALLOWED_COL_TYPES: [],
        BASE_COLORS: [
          '#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78', '#2ca02c', '#98df8a',
          '#d62728', '#ff9896', '#9467bd', '#c5b0d5', '#8c564b', '#c49c94',
          '#e377c2', '#f7b6d2', '#7f7f7f', '#c7c7c7', '#bcbd22', '#dbdb8d',
          '#17becf', '#9edae5'
        ],
        BASE_ORDERED_GRADIENT: null as any,
        BASE_UNORDERED_GRADIENT: null as any,
        EXTRA_GRADIENTS: [] as any,
        GRADIENT_COL_TYPES: [],
        ITEM_MISSING_COLOR: '#B0BEC5',
        MAX_ALLOWED_UNIQUE_VALUES: 50,
      },
    },
    lineList: {
      CASE_SET_MEMBERS_FETCH_DEBOUNCE_DELAY_MS: 300,
      MAX_COLUMN_WIDTH: 300,
      REQUIRED_EXTRA_CELL_PADDING_TO_FIT_CONTENT: 8,
      TABLE_ROW_HEIGHT: 28,
    },
    map: {
      MIN_PIE_CHART_RADIUS: 10,
    },
    tree: {
      ANCESTOR_DOT_RADIUS: 3,
      HEADER_HEIGHT: 40,
      INITIAL_UNLINKED_ZOOM_LEVEL: 1,
      LEAF_DOT_RADIUS: 4,
      LINKED_SCROLL_DEBOUNCE_DELAY_MS: 50,
      MAX_SCALE_WIDTH_PX: 100,
      MAX_ZOOM_LEVEL: 15,
      MAX_ZOOM_SPEED: 0.3,
      MIN_SCALE_WIDTH_PX: 30,
      MIN_ZOOM_LEVEL: 0.05,
      MIN_ZOOM_SPEED: 0.02,
      MINIMUM_DISTANCE_PERCENTAGE_TO_SHOW_LABEL: 0.02,
      PANNING_THRESHOLD: 4,
      REGULAR_FILL_COLOR_SUPPORT_LINE: '#CBD5E1',
      SCALE_INCREMENTS: [1, 2, 5],
      TAKING_LONGER_TIMEOUT_MS: 5000,
      TREE_PADDING: 20,
    },
    trends: {
      homePage: {
        getSinceDate: () => '2020-01-01',
        getSinceLabel: () => 'Since 2020',
      },
    },
  };

  ConfigService.getInstance<any>().config = config;

  // Initialize native canvas drawing extensions
  setupTreeCanvasDrawing();
}
