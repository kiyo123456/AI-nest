import { useState } from "react";
import { useStore } from "../../store";
import type { TreeNode } from "../../data";

/** ファイルツリー風の折りたたみインデント（案4）。深い木に強い。 */
export function IndentTree() {
  const { selectedTreeId, selectedNodeId, rootOf, pathTo } = useStore();
  const root = rootOf(selectedTreeId);
  if (!root) return null;
  const pathIds = new Set(pathTo(selectedNodeId).map((n) => n.id));

  return (
    <div className="indent-tree">
      <Row node={root} depth={0} pathIds={pathIds} selectedNodeId={selectedNodeId} />
    </div>
  );
}

function Row({
  node,
  depth,
  pathIds,
  selectedNodeId,
}: {
  node: TreeNode;
  depth: number;
  pathIds: Set<string>;
  selectedNodeId: string;
}) {
  const { childrenOf, selectNode } = useStore();
  const children = childrenOf(node.id);
  const [open, setOpen] = useState(true);
  const isCurrent = node.id === selectedNodeId;
  const onPath = pathIds.has(node.id);

  return (
    <div>
      <div
        className={
          "indent-row" +
          (isCurrent ? " current" : "") +
          (onPath ? " on-path" : "")
        }
        style={{ paddingLeft: depth * 16 + 8 }}
      >
        {children.length > 0 ? (
          <span
            className="caret"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((o) => !o);
            }}
          >
            {open ? "▾" : "▸"}
          </span>
        ) : (
          <span className="caret empty">•</span>
        )}
        <span className="indent-label" onClick={() => selectNode(node.id)}>
          {node.title}
        </span>
        {isCurrent && <span className="here">今ここ</span>}
      </div>
      {open &&
        children.map((c) => (
          <Row
            key={c.id}
            node={c}
            depth={depth + 1}
            pathIds={pathIds}
            selectedNodeId={selectedNodeId}
          />
        ))}
    </div>
  );
}
