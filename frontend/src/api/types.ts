/**
 * Shapes returned by the Laravel API resources.
 * Responses are wrapped: `{ data: ... }`.
 */

export type ApiResource<T> = { data: T };

export type User = {
  id: number;
  name: string;
  email: string;
  created_at: string;
};

export type Project = {
  id: number;
  project_name: string;
  nodes_count?: number;
  created_at: string;
  updated_at: string;
};

export type NodeResource = {
  id: number;
  project_id: number;
  parent_id: number | null;
  branch_from_message_id: number | null;
  summary: string | null;
  children_count?: number;
  messages_count?: number;
  created_at: string;
  updated_at: string;
};

export type MessageResource = {
  id: number;
  node_id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};
