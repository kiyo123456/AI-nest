import { useStore } from "../../store";
import type { TreeNode } from "../../data";

type Pos = { node: TreeNode; x: number; y: number; depth: number };

/** 案6：横方向のマインドマップ（中心テーマから枝が曲線で広がる）。 */
export function MindMap({ large = false }: { large?: boolean }) {
  const { selectedTreeId, selectedNodeId, rootOf, childrenOf, pathTo, selectNode } =
    useStore();
  const root = rootOf(selectedTreeId);
  if (!root) return null;

  const xStep = large ? 230 : 188;
  const yStep = large ? 66 : 56;
  const padX = 16;
  const padY = 28;
  const pill = large ? { w: 180, h: 40 } : { w: 156, h: 34 };

  let slot = 0;
  const yOf = new Map<string, number>();
  const assign = (n: TreeNode): number => {
    const ch = childrenOf(n.id);
    if (ch.length === 0) {
      yOf.set(n.id, slot++);
      return yOf.get(n.id)!;
    }
    const ys = ch.map(assign);
    const y = (ys[0] + ys[ys.length - 1]) / 2;
    yOf.set(n.id, y);
    return y;
  };
  assign(root);
  const totalLeaves = slot;

  const nodes: Pos[] = [];
  const edges: { from: Pos; to: Pos }[] = [];
  const place = (n: TreeNode, depth: number): Pos => {
    const x = padX + depth * xStep;
    const y = padY + yOf.get(n.id)! * yStep;
    const pos: Pos = { node: n, x, y, depth };
    nodes.push(pos);
    childrenOf(n.id).forEach((c) => {
      const cp = place(c, depth + 1);
      edges.push({ from: pos, to: cp });
    });
    return pos;
  };
  place(root, 0);

  const maxDepth = Math.max(...nodes.map((n) => n.depth));
  const width = padX * 2 + maxDepth * xStep + pill.w + 20;
  const height = padY * 2 + Math.max(totalLeaves - 1, 1) * yStep + 40;
  const pathIds = new Set(pathTo(selectedNodeId).map((n) => n.id));

  return (
    <div className="mm-wrap">
      <svg width={width} height={height} className="mm-svg">
        {edges.map((e, i) => {
          const x1 = e.from.x + pill.w;
          const y1 = e.from.y;
          const x2 = e.to.x;
          const y2 = e.to.y;
          const mx = (x1 + x2) / 2;
          const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
          const on = pathIds.has(e.from.node.id) && pathIds.has(e.to.node.id);
          return (
            <path key={i} d={d} className={on ? "mm-edge on-path" : "mm-edge"} fill="none" />
          );
        })}
        {nodes.map((p) => {
          const isCur = p.node.id === selectedNodeId;
          const onP = pathIds.has(p.node.id);
          const cls =
            "mm-pill" +
            (p.depth === 0 ? " root" : "") +
            (isCur ? " current" : onP ? " on-path" : "");
          return (
            <foreignObject
              key={p.node.id}
              x={p.x}
              y={p.y - pill.h / 2}
              width={pill.w}
              height={pill.h}
            >
              <div className={cls} onClick={() => selectNode(p.node.id)} title={p.node.title}>
                <span className="mm-label">{p.node.title}</span>
                {isCur && <span className="mm-here">今</span>}
              </div>
            </foreignObject>
          );
        })}
      </svg>
    </div>
  );
}
