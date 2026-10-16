import type { TreeNode } from '@gen-epix/ui-phylogenetic-tree/models/tree.models';

export enum TREE_DOWNLOAD_TYPE {
  JPEG = 'JPEG',
  PNG = 'PNG',
  SVG = 'SVG',
}


export interface NodeTooltipInfo {
  descendantCount?: number;
  isLeaf: boolean;
  metadata?: Record<string, string>;
  nodeName: string;
  subTreeLeaveNames?: string[];
  treeNode?: TreeNode;
  x: number;
  y: number;
}
