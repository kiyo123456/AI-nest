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
