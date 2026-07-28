import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNodes, useProjects } from "../api/queries";

/**
 * Which theme and which node the user is looking at.
 *
 * This is client state and deliberately separate from the server state React
 * Query caches: the selection is a UI concern that outlives any one fetch.
 */
type Selection = {
  selectedProjectId: number | null;
  selectedNodeId: number | null;
  selectProject: (projectId: number) => void;
  selectNode: (nodeId: number) => void;
};

const SelectionContext = createContext<Selection | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null,
  );
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);

  const { data: projects } = useProjects();
  const { data: nodes } = useNodes(selectedProjectId);

  // Land on the first theme once the list arrives.
  useEffect(() => {
    if (selectedProjectId === null && projects?.length) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // Then on that theme's root node — the start of the learning path.
  useEffect(() => {
    if (selectedNodeId !== null || !nodes?.length) return;
    const root = nodes.find((node) => node.parent_id === null) ?? nodes[0];
    setSelectedNodeId(root.id);
  }, [nodes, selectedNodeId]);

  const value = useMemo<Selection>(
    () => ({
      selectedProjectId,
      selectedNodeId,
      selectProject: (projectId) => {
        setSelectedProjectId(projectId);
        // Clearing lets the effect above pick the new theme's root.
        setSelectedNodeId(null);
      },
      selectNode: setSelectedNodeId,
    }),
    [selectedProjectId, selectedNodeId],
  );

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection must be used within SelectionProvider");
  return ctx;
}
