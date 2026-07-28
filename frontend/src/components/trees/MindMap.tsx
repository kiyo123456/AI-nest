import { useMemo } from "react";
import {
  Controls,
  ReactFlow,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import { useNodePath, useNodes } from "../../api/queries";
import { useSelection } from "../../selection/SelectionContext";
import { layoutTree, nodeLabel, rootOf } from "../../tree";
import { PillNode, type PillNodeType } from "./PillNode";

/** Pill geometry, shared by the layout maths and the CSS. */
const NODE_WIDTH = 156;
const NODE_HEIGHT = 34;
const LAYOUT = { xStep: 188, yStep: 56, nodeHeight: NODE_HEIGHT };

/** Registered once outside the component so React Flow never re-registers. */
const nodeTypes = { pill: PillNode };

/**
 * 案6：横方向のマインドマップ（中心テーマから枝が曲線で広がる）。
 *
 * React Flow gives it a real canvas — drag to pan, wheel to zoom, and the
 * whole tree is fitted on open — so a deep tree no longer runs off the edge
 * of the 380px pane the way the plain scrolling SVG did.
 */
export function MindMap() {
  const { selectedProjectId, selectedNodeId, selectNode } = useSelection();
  const { data: nodes, isPending, isError } = useNodes(selectedProjectId);
  // Same query the breadcrumb uses — React Query serves both from one request.
  const { data: path } = useNodePath(selectedNodeId);

  const all = useMemo(() => nodes ?? [], [nodes]);
  const root = rootOf(all);
  const pathIds = useMemo(
    () => new Set((path ?? []).map((node) => node.id)),
    [path],
  );

  const flowNodes = useMemo<PillNodeType[]>(() => {
    if (!root) return [];
    return layoutTree(all, root, LAYOUT).map(({ node, x, y, depth }) => ({
      id: String(node.id),
      type: "pill" as const,
      position: { x, y },
      // React Flow needs the size up front to fit the view before measuring.
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      data: {
        label: nodeLabel(node),
        isRoot: depth === 0,
        isCurrent: node.id === selectedNodeId,
        onPath: pathIds.has(node.id),
      },
    }));
  }, [all, root, selectedNodeId, pathIds]);

  const flowEdges = useMemo<Edge[]>(
    () =>
      all
        .filter((node) => node.parent_id !== null)
        .map((node) => ({
          id: `e${node.parent_id}-${node.id}`,
          source: String(node.parent_id),
          target: String(node.id),
          // Both ends on the highlighted path means the edge is on it too.
          className:
            pathIds.has(node.parent_id!) && pathIds.has(node.id)
              ? "on-path"
              : undefined,
        })),
    [all, pathIds],
  );

  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    selectNode(Number(node.id));
  };

  // A disabled query stays `isPending` forever, so rule out "nothing selected"
  // before treating that flag as "still loading".
  if (selectedProjectId === null) {
    return <p className="pane-note">学習テーマを選択してください。</p>;
  }
  if (isPending) return <p className="pane-note">読み込み中…</p>;
  if (isError) {
    return <p className="pane-note error">ツリーを取得できませんでした。</p>;
  }
  if (!root) {
    return <p className="pane-note">このテーマにはまだノードがありません。</p>;
  }

  return (
    <div className="mm-wrap">
      <ReactFlow
        // Remount per theme so the new tree gets fitted. Adding a branch keeps
        // the same key, which leaves the viewport the user panned to alone.
        key={selectedProjectId}
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        // Cap the initial fit at 1:1 — a one-node theme would otherwise be
        // blown up to maxZoom just because it has room to spare.
        fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
        minZoom={0.2}
        maxZoom={2}
        colorMode="dark"
        // Positions are derived from server data, not something the user
        // edits, so there is no local node state to keep in sync.
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
