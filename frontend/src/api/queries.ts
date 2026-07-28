import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type {
  ApiResource,
  MessageResource,
  NodeResource,
  Project,
} from "./types";

/**
 * Query keys, kept in one place so mutations in the next slice can invalidate
 * exactly the right slices of cache.
 */
export const keys = {
  projects: ["projects"] as const,
  nodes: (projectId: number) => ["projects", projectId, "nodes"] as const,
  messages: (nodeId: number) => ["nodes", nodeId, "messages"] as const,
  path: (nodeId: number) => ["nodes", nodeId, "path"] as const,
};

/** The signed-in user's learning themes. */
export function useProjects() {
  return useQuery({
    queryKey: keys.projects,
    queryFn: () => api.get<ApiResource<Project[]>>("/api/projects"),
    select: (response) => response.data,
  });
}

/**
 * Every node of a project in one request; the tree is assembled client-side.
 * (Adjacency list + a single `WHERE project_id = ?` — the shape chosen in the
 * data-modelling phase.)
 */
export function useNodes(projectId: number | null) {
  return useQuery({
    queryKey: keys.nodes(projectId ?? 0),
    queryFn: () =>
      api.get<ApiResource<NodeResource[]>>(`/api/projects/${projectId}/nodes`),
    select: (response) => response.data,
    enabled: projectId !== null,
  });
}

/** The conversation held in one node. */
export function useMessages(nodeId: number | null) {
  return useQuery({
    queryKey: keys.messages(nodeId ?? 0),
    queryFn: () =>
      api.get<ApiResource<MessageResource[]>>(`/api/nodes/${nodeId}/messages`),
    select: (response) => response.data,
    enabled: nodeId !== null,
  });
}

/**
 * Ancestor chain root → node, served by the recursive CTE.
 *
 * Both the breadcrumb and the mind map need this; React Query dedupes the
 * concurrent calls into a single request.
 */
export function useNodePath(nodeId: number | null) {
  return useQuery({
    queryKey: keys.path(nodeId ?? 0),
    queryFn: () =>
      api.get<ApiResource<NodeResource[]>>(`/api/nodes/${nodeId}/path`),
    select: (response) => response.data,
    enabled: nodeId !== null,
  });
}
