import { useStore } from "../../store";
import type { TreeNode } from "../../data";

/** 縦型の入れ子ツリー。案1（王道）と案2（右強調）で共有。 */
export function NestedTree({ emphasize = false }: { emphasize?: boolean }) {
  const { selectedTreeId, selectedNodeId, rootOf, pathTo } = useStore();
  const root = rootOf(selectedTreeId);
  if (!root) return null;
  const pathIds = new Set(pathTo(selectedNodeId).map((n) => n.id));

  return (
    <div className={"nested-tree" + (emphasize ? " emphasize" : "")}>
      <Branch node={root} pathIds={pathIds} selectedNodeId={selectedNodeId} />
    </div>
  );
}

function Branch({
  node,
  pathIds,
  selectedNodeId,
}: {
  node: TreeNode;
  pathIds: Set<string>;
  selectedNodeId: string;
}) {
  const { childrenOf, selectNode } = useStore();
  const children = childrenOf(node.id);
  const isCurrent = node.id === selectedNodeId;
  const onPath = pathIds.has(node.id);

  return (
    <div className="branch">
      <button
        className={
          "tree-node" +
          (isCurrent ? " current" : "") +
          (onPath ? " on-path" : "")
        }
        onClick={() => selectNode(node.id)}
      >
        <span className="tn-title">{node.title}</span>
        {isCurrent && <span className="here">今ここ</span>}
      </button>
      {children.length > 0 && (
        <div className="children">
          {children.map((c) => (
            <Branch
              key={c.id}
              node={c}
              pathIds={pathIds}
              selectedNodeId={selectedNodeId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
