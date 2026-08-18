import type { TreeNode } from '@gen-epix/ui-casedb';

export interface NodeTooltipInfo {
  x: number;
  y: number;
  nodeName: string;
  isLeaf: boolean;
  treeNode?: TreeNode;
  metadata?: Record<string, string>;
  descendantCount?: number;
  subTreeLeaveNames?: string[];
}

export interface TreeViewState {
  zoomLevel: number;
  horizontalScrollPosition: number;
  verticalScrollPosition: number;
}
