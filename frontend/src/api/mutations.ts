import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { keys } from "./queries";
import type {
  ApiResource,
  MessageResource,
  NodeResource,
  Project,
} from "./types";

/** Temporary id for a message that hasn't been saved yet. */
let optimisticSeq = 0;
const nextOptimisticId = () => --optimisticSeq;

export const isOptimistic = (message: MessageResource) => message.id < 0;

/**
 * Ask the AI within a node's thread.
 *
 * The reply takes tens of seconds, so the user's own message is shown
 * immediately and the answer streams in behind it.
 */
export function useSendChat(nodeId: number | null) {
  const queryClient = useQueryClient();
  const messagesKey = keys.messages(nodeId ?? 0);

  return useMutation({
    mutationFn: (content: string) =>
      api.post<ApiResource<MessageResource[]>>(`/api/nodes/${nodeId}/chat`, {
        content,
      }),

    onMutate: async (content) => {
      await queryClient.cancelQueries({ queryKey: messagesKey });

      // The cache holds the raw response: `select` only shapes what the
      // component reads, so writes have to keep the `{ data: [...] }` envelope.
      const previous =
        queryClient.getQueryData<ApiResource<MessageResource[]>>(messagesKey);

      const optimistic: MessageResource = {
        id: nextOptimisticId(),
        node_id: nodeId!,
        role: "user",
        content,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<ApiResource<MessageResource[]>>(messagesKey, {
        data: [...(previous?.data ?? []), optimistic],
      });

      return { previous };
    },

    onSuccess: (response) => {
      // Replace the placeholder with what was actually stored.
      queryClient.setQueryData<ApiResource<MessageResource[]>>(
        messagesKey,
        (current) => ({
          data: [
            ...(current?.data ?? []).filter((m) => !isOptimistic(m)),
            ...response.data,
          ],
        }),
      );
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },

    onError: () => {
      // Deliberately not a rollback. The API keeps the user's message even when
      // the AI call fails, so restoring the snapshot would hide a message that
      // really was saved. Refetching shows whatever the server actually has —
      // which is also correct if the request never arrived.
      queryClient.invalidateQueries({ queryKey: messagesKey });
    },
  });
}

/** Create a child node that branches off a specific message. */
export function useCreateBranch(projectId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      parent_id: number;
      branch_from_message_id: number;
      summary: string;
    }) =>
      api.post<ApiResource<NodeResource>>(
        `/api/projects/${projectId}/nodes`,
        input,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.nodes(projectId ?? 0) });
    },
  });
}

/** Start a new learning theme, with the root node its conversation begins at. */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectName: string) => {
      const project = await api.post<ApiResource<Project>>("/api/projects", {
        project_name: projectName,
      });
      // A project with no nodes has nowhere to talk, so give it a root.
      // Creating it here keeps `POST /projects` free of side effects.
      const root = await api.post<ApiResource<NodeResource>>(
        `/api/projects/${project.data.id}/nodes`,
        { summary: projectName },
      );
      return { project: project.data, root: root.data };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.projects });
    },
  });
}
