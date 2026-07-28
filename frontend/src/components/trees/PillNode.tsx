import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

export type PillData = {
  label: string;
  isRoot: boolean;
  isCurrent: boolean;
  onPath: boolean;
};

export type PillNodeType = Node<PillData, "pill">;

/**
 * The pill from the hand-drawn SVG version, now a React Flow node.
 *
 * The markup and the `.mm-pill` classes are unchanged — React Flow nodes are
 * plain HTML, so the whole look (root gradient, current badge, path
 * highlight) carries over from the styles that were already there.
 *
 * The handles are invisible and only exist to anchor the edges: putting the
 * target on the left and the source on the right makes the default bezier
 * curve identical to the cubic the old SVG drew by hand.
 */
export function PillNode({ data }: NodeProps<PillNodeType>) {
  const { label, isRoot, isCurrent, onPath } = data;
  const className =
    "mm-pill" +
    (isRoot ? " root" : "") +
    (isCurrent ? " current" : onPath ? " on-path" : "");

  return (
    <div className={className} title={label}>
      <Handle type="target" position={Position.Left} />
      <span className="mm-label">{label}</span>
      {isCurrent && <span className="mm-here">今</span>}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
