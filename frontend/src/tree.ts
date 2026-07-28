import type { NodeResource } from "./api/types";

/**
 * Helpers for turning the flat node list into a tree.
 *
 * The API returns every node of a project in one request (adjacency list via
 * `parent_id`), and the shape is assembled here rather than server-side.
 */

export function rootOf(nodes: NodeResource[]): NodeResource | undefined {
  return nodes.find((node) => node.parent_id === null);
}

export function childrenOf(
  nodes: NodeResource[],
  parentId: number,
): NodeResource[] {
  return nodes.filter((node) => node.parent_id === parentId);
}

/** `summary` is nullable in the schema, so give unnamed nodes a label. */
export function nodeLabel(node: NodeResource): string {
  return node.summary ?? "（無題のノード）";
}

export type PlacedNode = {
  node: NodeResource;
  /** Top-left corner, which is the origin React Flow expects. */
  x: number;
  y: number;
  depth: number;
};

export type LayoutOptions = {
  /** Horizontal distance between generations. */
  xStep: number;
  /** Vertical distance between two sibling rows. */
  yStep: number;
  /** Node height, needed to convert a row centre into a top edge. */
  nodeHeight: number;
};

/**
 * Decide where every node sits, root on the left and children fanning right.
 *
 * React Flow draws and pans but never positions anything, so the shape of the
 * tree stays our decision. The rule is the simple one this app has always
 * used: leaves take the next free row, and a parent sits centred between its
 * first and last child.
 */
export function layoutTree(
  nodes: NodeResource[],
  root: NodeResource,
  { xStep, yStep, nodeHeight }: LayoutOptions,
): PlacedNode[] {
  let nextRow = 0;
  const rowOf = new Map<number, number>();

  const assignRow = (node: NodeResource): number => {
    const children = childrenOf(nodes, node.id);
    if (children.length === 0) {
      const row = nextRow++;
      rowOf.set(node.id, row);
      return row;
    }
    const rows = children.map(assignRow);
    const row = (rows[0] + rows[rows.length - 1]) / 2;
    rowOf.set(node.id, row);
    return row;
  };
  assignRow(root);

  const placed: PlacedNode[] = [];
  const place = (node: NodeResource, depth: number): void => {
    placed.push({
      node,
      x: depth * xStep,
      // `rowOf` is the centre of the row; React Flow wants the top edge.
      y: rowOf.get(node.id)! * yStep - nodeHeight / 2,
      depth,
    });
    childrenOf(nodes, node.id).forEach((child) => place(child, depth + 1));
  };
  place(root, 0);

  return placed;
}
