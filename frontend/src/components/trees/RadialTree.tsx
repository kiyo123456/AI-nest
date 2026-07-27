import { useStore } from "../../store";
import type { TreeNode } from "../../data";

type Pos = { node: TreeNode; x: number; y: number; depth: number };

/** 放射状ツリー（案3）。中心＝テーマ、外側へ枝が広がる。 */
export function RadialTree() {
  const { selectedTreeId, selectedNodeId, rootOf, childrenOf, pathTo, selectNode } =
    useStore();
  const root = rootOf(selectedTreeId);
  if (!root) return null;

  const W = 360;
  const H = 360;
  const cx = W / 2;
  const cy = H / 2;
  const ringStep = 70;

  // リーフ順に角度を割り当て → 内部ノードは子の平均角度
  const leaves: TreeNode[] = [];
  const collectLeaves = (n: TreeNode) => {
    const ch = childrenOf(n.id);
    if (ch.length === 0) leaves.push(n);
    else ch.forEach(collectLeaves);
  };
  collectLeaves(root);

  const angleOf = new Map<string, number>();
  leaves.forEach((leaf, i) => {
    angleOf.set(leaf.id, (i + 0.5) * ((2 * Math.PI) / Math.max(leaves.length, 1)));
  });
  const resolveAngle = (n: TreeNode): number => {
    if (angleOf.has(n.id)) return angleOf.get(n.id)!;
    const ch = childrenOf(n.id);
    const a = ch.reduce((s, c) => s + resolveAngle(c), 0) / ch.length;
    angleOf.set(n.id, a);
    return a;
  };
  resolveAngle(root);

  const positions: Pos[] = [];
  const edges: { from: Pos; to: Pos }[] = [];
  const place = (n: TreeNode, depth: number): Pos => {
    const angle = angleOf.get(n.id)!;
    const r = depth * ringStep;
    const x = depth === 0 ? cx : cx + r * Math.cos(angle);
    const y = depth === 0 ? cy : cy + r * Math.sin(angle);
    const pos = { node: n, x, y, depth };
    positions.push(pos);
    childrenOf(n.id).forEach((c) => {
      const cp = place(c, depth + 1);
      edges.push({ from: pos, to: cp });
    });
    return pos;
  };
  place(root, 0);

  const pathIds = new Set(pathTo(selectedNodeId).map((n) => n.id));

  return (
    <div className="radial-wrap">
      <svg width={W} height={H} className="radial-svg">
        {edges.map((e, i) => (
          <line
            key={i}
            x1={e.from.x}
            y1={e.from.y}
            x2={e.to.x}
            y2={e.to.y}
            className={
              pathIds.has(e.from.node.id) && pathIds.has(e.to.node.id)
                ? "edge on-path"
                : "edge"
            }
          />
        ))}
        {positions.map((p) => {
          const isCurrent = p.node.id === selectedNodeId;
          const onPath = pathIds.has(p.node.id);
          return (
            <g
              key={p.node.id}
              transform={`translate(${p.x},${p.y})`}
              className="radial-node"
              onClick={() => selectNode(p.node.id)}
            >
              <circle
                r={isCurrent ? 11 : 7}
                className={
                  "rnode" + (isCurrent ? " current" : onPath ? " on-path" : "")
                }
              />
              <text x={12} y={4} className="rlabel">
                {p.node.title.length > 12
                  ? p.node.title.slice(0, 12) + "…"
                  : p.node.title}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
