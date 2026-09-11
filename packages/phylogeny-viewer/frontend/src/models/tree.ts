import type { TreeNode } from '@gen-epix/ui-phylogenetic-tree/models/tree';

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
