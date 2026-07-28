import { useState } from "react";
import { ThemeSidebar } from "./components/ThemeSidebar";
import { ChatPanel } from "./components/ChatPanel";
import { MindMap } from "./components/trees/MindMap";
import { useSelection } from "./selection/SelectionContext";

/**
 * 案6：マインドマップ（採用）。
 *
 * チャットが主役で、左のテーマ一覧と右のマインドマップはそれぞれ開閉でき、
 * マップは全画面にもできる。比較検討した案1〜5は `prototype/` に残してある。
 */
export function Layout6() {
  const { selectedNodeId } = useSelection();
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [full, setFull] = useState(false);
  const cols =
    (leftOpen ? "220px" : "0px") + " 1fr " + (rightOpen ? "380px" : "0px");

  return (
    <div className="layout layout6" style={{ gridTemplateColumns: cols }}>
      <div
        className="collapsible left"
        style={{ display: leftOpen ? "block" : "none" }}
      >
        <ThemeSidebar />
      </div>
      <div className="center6">
        <div className="toolbar6">
          <button onClick={() => setLeftOpen((o) => !o)}>
            {leftOpen ? "⟨ テーマを隠す" : "テーマを表示 ⟩"}
          </button>
          <div className="spacer" />
          <button onClick={() => setFull(true)}>マインドマップ全画面 ⤢</button>
          <button onClick={() => setRightOpen((o) => !o)}>
            {rightOpen ? "マップを隠す ⟩" : "⟨ マップを表示"}
          </button>
        </div>
        {/* Remounting per node clears the draft, the open branch form, and any
            error left over from the node the user just moved away from. */}
        <ChatPanel key={selectedNodeId} showBreadcrumb />
      </div>
      <div
        className="collapsible right"
        style={{ display: rightOpen ? "block" : "none" }}
      >
        <div className="right-pane">
          <div className="sidebar-head">思考の樹形図（マインドマップ）</div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <MindMap />
          </div>
        </div>
      </div>
      {full && (
        <div className="fullscreen-tree" onClick={() => setFull(false)}>
          <div className="ft-inner big" onClick={(e) => e.stopPropagation()}>
            <div className="ft-head">
              <span>思考の樹形図（マインドマップ・全画面）</span>
              <button onClick={() => setFull(false)}>閉じる ✕</button>
            </div>
            {/* No `large` variant any more: zoom normalises the scale, so a
                bigger pixel size would just be undone by fitView. */}
            <div className="ft-canvas">
              <MindMap />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
