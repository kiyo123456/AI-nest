import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  initialNodes,
  nextId,
  trees,
  type Message,
  type Tree,
  type TreeNode,
} from "./data";

type Store = {
  trees: Tree[];
  nodes: TreeNode[];
  selectedTreeId: string;
  selectedNodeId: string;
  selectTree: (treeId: string) => void;
  selectNode: (nodeId: string) => void;
  /** あるノードの指定メッセージから子ノード（枝）を作る */
  branchFrom: (nodeId: string, messageIndex: number) => void;
  /** 簡易: 選択中ノードにユーザー発話とダミー回答を追加 */
  sendMessage: (content: string) => void;
  /** ルートから対象ノードまでのパス（パンくず用） */
  pathTo: (nodeId: string) => TreeNode[];
  childrenOf: (nodeId: string) => TreeNode[];
  rootOf: (treeId: string) => TreeNode | undefined;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [nodes, setNodes] = useState<TreeNode[]>(initialNodes);
  const [selectedTreeId, setSelectedTreeId] = useState<string>("t_laravel");
  const [selectedNodeId, setSelectedNodeId] = useState<string>("n_pdo");

  const value = useMemo<Store>(() => {
    const nodeById = (id: string) => nodes.find((n) => n.id === id);

    const rootOf = (treeId: string) =>
      nodes.find((n) => n.treeId === treeId && n.parentId === null);

    const childrenOf = (nodeId: string) =>
      nodes.filter((n) => n.parentId === nodeId);

    const pathTo = (nodeId: string): TreeNode[] => {
      const path: TreeNode[] = [];
      let cur = nodeById(nodeId);
      while (cur) {
        path.unshift(cur);
        cur = cur.parentId ? nodeById(cur.parentId) : undefined;
      }
      return path;
    };

    const selectTree = (treeId: string) => {
      setSelectedTreeId(treeId);
      const root = rootOf(treeId);
      if (root) setSelectedNodeId(root.id);
    };

    const selectNode = (nodeId: string) => setSelectedNodeId(nodeId);

    const branchFrom = (nodeId: string, messageIndex: number) => {
      const parent = nodeById(nodeId);
      if (!parent) return;
      const id = nextId("n");
      const child: TreeNode = {
        id,
        treeId: parent.treeId,
        parentId: parent.id,
        branchFromIndex: messageIndex,
        title: "新しい枝",
        messages: [
          {
            id: nextId("m"),
            role: "user",
            content: "（ここに脱線した質問を書く）",
          },
        ],
      };
      setNodes((prev) => [...prev, child]);
      setSelectedNodeId(id);
    };

    const sendMessage = (content: string) => {
      const reply: Message = {
        id: nextId("m"),
        role: "assistant",
        content: "（AIのダミー回答）" + content + " について説明します…",
      };
      const userMsg: Message = { id: nextId("m"), role: "user", content };
      setNodes((prev) =>
        prev.map((n) =>
          n.id === selectedNodeId
            ? { ...n, messages: [...n.messages, userMsg, reply] }
            : n
        )
      );
    };

    return {
      trees,
      nodes,
      selectedTreeId,
      selectedNodeId,
      selectTree,
      selectNode,
      branchFrom,
      sendMessage,
      pathTo,
      childrenOf,
      rootOf,
    };
  }, [nodes, selectedTreeId, selectedNodeId]);

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
