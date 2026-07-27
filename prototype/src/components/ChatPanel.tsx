import { useState } from "react";
import { useStore } from "../store";

export function ChatPanel({ showBreadcrumb = false }: { showBreadcrumb?: boolean }) {
  const { nodes, selectedNodeId, pathTo, branchFrom, sendMessage, selectNode } =
    useStore();
  const node = nodes.find((n) => n.id === selectedNodeId);
  const [draft, setDraft] = useState("");

  if (!node) return <div className="chat-panel">ノードを選択してください</div>;

  const path = pathTo(node.id);

  return (
    <section className="chat-panel">
      {showBreadcrumb && (
        <nav className="breadcrumb">
          {path.map((p, i) => (
            <span key={p.id}>
              {i > 0 && <span className="sep">›</span>}
              <button
                className={p.id === node.id ? "crumb current" : "crumb"}
                onClick={() => selectNode(p.id)}
              >
                {p.title}
              </button>
            </span>
          ))}
        </nav>
      )}

      <div className="chat-title">{node.title}</div>

      <div className="messages">
        {node.messages.map((m, idx) => (
          <div key={m.id} className={"msg " + m.role}>
            <div className="bubble">{m.content}</div>
            {m.role === "assistant" && (
              <button
                className="branch-btn"
                title="この回答から枝を作る"
                onClick={() => branchFrom(node.id, idx)}
              >
                ⌥ ここから枝を作る
              </button>
            )}
          </div>
        ))}
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          sendMessage(draft.trim());
          setDraft("");
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="続けて質問する…"
        />
        <button type="submit">送信</button>
      </form>
    </section>
  );
}
