import type { NodeResource } from "../../api/types";
import { useNodePath, useNodes } from "../../api/queries";
import { useSelection } from "../../selection/SelectionContext";
import { childrenOf, nodeLabel, rootOf } from "../../tree";

type Pos = { node: NodeResource; x: number; y: number; depth: number };

/** 案6：横方向のマインドマップ（中心テーマから枝が曲線で広がる）。 */
export function MindMap({ large = false }: { large?: boolean }) {
  const { selectedProjectId, selectedNodeId, selectNode } = useSelection();
  const { data: nodes, isPending, isError } = useNodes(selectedProjectId);
  // Same query the breadcrumb uses — React Query serves both from one request.
  const { data: path } = useNodePath(selectedNodeId);

  // A disabled query stays `isPending` forever, so rule out "nothing selected"
  // before treating that flag as "still loading".
  if (selectedProjectId === null) {
    return <p className="pane-note">学習テーマを選択してください。</p>;
  }
  if (isPending) return <p className="pane-note">読み込み中…</p>;
  if (isError) {
    return <p className="pane-note error">ツリーを取得できませんでした。</p>;
  }

  const all = nodes ?? [];
  const root = rootOf(all);
  if (!root) {
    return <p className="pane-note">このテーマにはまだノードがありません。</p>;
  }

  const xStep = large ? 230 : 188;
  const yStep = large ? 66 : 56;
  const padX = 16;
  const padY = 28;
  const pill = large ? { w: 180, h: 40 } : { w: 156, h: 34 };

  // Leaves take the next row; a parent sits centred between its children.
  let slot = 0;
  const yOf = new Map<number, number>();
  const assign = (node: NodeResource): number => {
    const children = childrenOf(all, node.id);
    if (children.length === 0) {
      yOf.set(node.id, slot++);
      return yOf.get(node.id)!;
    }
    const ys = children.map(assign);
    const y = (ys[0] + ys[ys.length - 1]) / 2;
    yOf.set(node.id, y);
    return y;
  };
  assign(root);
  const totalLeaves = slot;

  const positions: Pos[] = [];
  const edges: { from: Pos; to: Pos }[] = [];
  const place = (node: NodeResource, depth: number): Pos => {
    const pos: Pos = {
      node,
      x: padX + depth * xStep,
      y: padY + yOf.get(node.id)! * yStep,
      depth,
    };
    positions.push(pos);
    childrenOf(all, node.id).forEach((child) => {
      edges.push({ from: pos, to: place(child, depth + 1) });
    });
    return pos;
  };
  place(root, 0);

  const maxDepth = Math.max(...positions.map((p) => p.depth));
  const width = padX * 2 + maxDepth * xStep + pill.w + 20;
  const height = padY * 2 + Math.max(totalLeaves - 1, 1) * yStep + 40;
  const pathIds = new Set((path ?? []).map((node) => node.id));

  return (
    <div className="mm-wrap">
      <svg width={width} height={height} className="mm-svg">
        {edges.map((edge, i) => {
          const x1 = edge.from.x + pill.w;
          const y1 = edge.from.y;
          const x2 = edge.to.x;
          const y2 = edge.to.y;
          const mx = (x1 + x2) / 2;
          const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
          const onPath =
            pathIds.has(edge.from.node.id) && pathIds.has(edge.to.node.id);
          return (
            <path
              key={i}
              d={d}
              className={onPath ? "mm-edge on-path" : "mm-edge"}
              fill="none"
            />
          );
        })}
        {positions.map((pos) => {
          const isCurrent = pos.node.id === selectedNodeId;
          const onPath = pathIds.has(pos.node.id);
          const cls =
            "mm-pill" +
            (pos.depth === 0 ? " root" : "") +
            (isCurrent ? " current" : onPath ? " on-path" : "");
          const label = nodeLabel(pos.node);
          return (
            <foreignObject
              key={pos.node.id}
              x={pos.x}
              y={pos.y - pill.h / 2}
              width={pill.w}
              height={pill.h}
            >
              <div
                className={cls}
                onClick={() => selectNode(pos.node.id)}
                title={label}
              >
                <span className="mm-label">{label}</span>
                {isCurrent && <span className="mm-here">今</span>}
              </div>
            </foreignObject>
          );
        })}
      </svg>
    </div>
  );
}
