import { useState, type FormEvent } from "react";
import { useMessages, useNodePath } from "../api/queries";
import { isOptimistic, useCreateBranch, useSendChat } from "../api/mutations";
import { useSelection } from "../selection/SelectionContext";
import { nodeLabel } from "../tree";

export function ChatPanel({ showBreadcrumb = false }: { showBreadcrumb?: boolean }) {
  const { selectedProjectId, selectedNodeId, selectNode } = useSelection();
  const { data: path } = useNodePath(selectedNodeId);
  const { data: messages, isPending, isError } = useMessages(selectedNodeId);

  const sendChat = useSendChat(selectedNodeId);
  const createBranch = useCreateBranch(selectedProjectId);

  const [draft, setDraft] = useState("");
  // Which message the user is currently branching from, and the title so far.
  const [branchingFrom, setBranchingFrom] = useState<number | null>(null);
  const [branchTitle, setBranchTitle] = useState("");

  if (selectedNodeId === null) {
    return <section className="chat-panel">ノードを選択してください</section>;
  }

  const current = path?.[path.length - 1];

  function handleSend(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sendChat.isPending) return;
    // Cleared only once the message is safely stored, so a failure leaves the
    // text in the box to retry with.
    sendChat.mutate(content, { onSuccess: () => setDraft("") });
  }

  function handleCreateBranch(event: FormEvent, messageId: number) {
    event.preventDefault();
    const summary = branchTitle.trim();
    if (!summary || createBranch.isPending) return;

    createBranch.mutate(
      {
        parent_id: selectedNodeId!,
        branch_from_message_id: messageId,
        summary,
      },
      {
        onSuccess: (response) => {
          setBranchingFrom(null);
          setBranchTitle("");
          // Jump into the new branch so the next question continues there.
          selectNode(response.data.id);
        },
      },
    );
  }

  return (
    <section className="chat-panel">
      {showBreadcrumb && path && (
        <nav className="breadcrumb">
          {path.map((node, index) => (
            <span key={node.id}>
              {index > 0 && <span className="sep">›</span>}
              <button
                className={node.id === selectedNodeId ? "crumb current" : "crumb"}
                onClick={() => selectNode(node.id)}
              >
                {nodeLabel(node)}
              </button>
            </span>
          ))}
        </nav>
      )}

      <div className="chat-title">{current ? nodeLabel(current) : ""}</div>

      <div className="messages">
        {isPending && <p className="pane-note">読み込み中…</p>}
        {isError && (
          <p className="pane-note error">発話を取得できませんでした。</p>
        )}
        {messages?.length === 0 && !sendChat.isPending && (
          <p className="pane-note">このノードにはまだ発話がありません。</p>
        )}

        {messages?.map((message) => (
          <div key={message.id} className={"msg " + message.role}>
            <div
              className={isOptimistic(message) ? "bubble pending" : "bubble"}
            >
              {message.content}
            </div>

            {message.role === "assistant" && (
              <>
                <button
                  className="branch-btn"
                  title="この回答から枝を作る"
                  onClick={() => {
                    setBranchingFrom(message.id);
                    setBranchTitle("");
                  }}
                >
                  ⌥ ここから枝を作る
                </button>

                {branchingFrom === message.id && (
                  <form
                    className="branch-form"
                    onSubmit={(e) => handleCreateBranch(e, message.id)}
                  >
                    <input
                      value={branchTitle}
                      onChange={(e) => setBranchTitle(e.target.value)}
                      placeholder="この枝で何を調べる？"
                      autoFocus
                    />
                    <button type="submit" disabled={createBranch.isPending}>
                      {createBranch.isPending ? "作成中…" : "作成"}
                    </button>
                    <button type="button" onClick={() => setBranchingFrom(null)}>
                      キャンセル
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        ))}

        {/* Kept out of the cache: it is a UI state, not a stored message. */}
        {sendChat.isPending && (
          <div className="msg assistant">
            <div className="bubble thinking">考え中…</div>
          </div>
        )}

        {sendChat.isError && (
          <p className="pane-note error">
            {sendChat.error instanceof Error
              ? sendChat.error.message
              : "送信に失敗しました。"}
          </p>
        )}
        {createBranch.isError && (
          <p className="pane-note error">枝を作成できませんでした。</p>
        )}
      </div>

      <form className="composer" onSubmit={handleSend}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="続けて質問する…"
          disabled={sendChat.isPending}
        />
        <button type="submit" disabled={sendChat.isPending || !draft.trim()}>
          {sendChat.isPending ? "送信中…" : "送信"}
        </button>
      </form>
    </section>
  );
}
