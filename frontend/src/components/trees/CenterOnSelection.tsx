import { useEffect, useRef } from "react";
import { useReactFlow, useStore } from "@xyflow/react";

/** Slack around the node before it counts as "off screen". */
const MARGIN = 12;
const ANIMATION_MS = 300;

type Props = {
  nodeId: number | null;
  /** Re-runs the effect when the graph grows, so a just-created branch is
   *  retried once React Flow knows about it. */
  nodeCount: number;
};

/**
 * Bring the selected node into view when it is off screen.
 *
 * Since 6-4 the map can be panned, which means the user can now be looking
 * somewhere else when they jump to a node from the breadcrumb or by creating
 * a branch. Landing on a node you cannot see contradicts the whole point of
 * the map, so the view follows the selection — but only when it has to:
 * if the node is already visible nothing moves, because the position the user
 * chose is worth more than a centred one.
 *
 * Must be rendered inside <ReactFlow>, which is what provides this context.
 */
export function CenterOnSelection({ nodeId, nodeCount }: Props) {
  const { getNode, getViewport, setCenter } = useReactFlow();
  // The pane's own size, measured by React Flow.
  const paneWidth = useStore((state) => state.width);
  const paneHeight = useStore((state) => state.height);
  const handledId = useRef<number | null>(null);
  const sawFirstSelection = useRef(false);

  useEffect(() => {
    if (nodeId === null || paneWidth === 0 || paneHeight === 0) return;
    if (handledId.current === nodeId) return;

    const node = getNode(String(nodeId));
    // Right after a branch is created the node exists in our state before
    // React Flow has it. Leaving the ref alone means a later render retries.
    if (!node) return;
    handledId.current = nodeId;

    // The first selection belongs to `fitView`, which runs on mount (and on
    // every theme switch, since the map is remounted per project) and already
    // puts the whole tree on screen. Racing it would replace that overview
    // with a close-up of the root.
    if (!sawFirstSelection.current) {
      sawFirstSelection.current = true;
      return;
    }

    const width = node.width ?? node.measured?.width ?? 0;
    const height = node.height ?? node.measured?.height ?? 0;
    const { x, y, zoom } = getViewport();

    // Flow coordinates → where the node actually sits inside the pane.
    const left = node.position.x * zoom + x;
    const top = node.position.y * zoom + y;
    const right = left + width * zoom;
    const bottom = top + height * zoom;

    const visible =
      left >= MARGIN &&
      top >= MARGIN &&
      right <= paneWidth - MARGIN &&
      bottom <= paneHeight - MARGIN;

    if (visible) return;

    setCenter(node.position.x + width / 2, node.position.y + height / 2, {
      // Keep the current zoom: the user may have deliberately pulled back for
      // an overview, and moving to a node should not undo that.
      zoom,
      // The animation is a d3 transition driven by requestAnimationFrame, and
      // rAF is suspended while the tab is in the background — the move would
      // silently never happen. Jump straight there instead when hidden.
      duration: document.visibilityState === "visible" ? ANIMATION_MS : 0,
    });
  }, [
    nodeId,
    nodeCount,
    paneWidth,
    paneHeight,
    getNode,
    getViewport,
    setCenter,
  ]);

  return null;
}
