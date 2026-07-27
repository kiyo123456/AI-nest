import { useState } from "react";
import { ThemeSidebar } from "./components/ThemeSidebar";
import { ChatPanel } from "./components/ChatPanel";
import { NestedTree } from "./components/trees/NestedTree";
import { RadialTree } from "./components/trees/RadialTree";
import { IndentTree } from "./components/trees/IndentTree";
import { MindMap } from "./components/trees/MindMap";

export type LayoutDef = {
  id: string;
  label: string;
  note: string;
  render: () => JSX.Element;
};

/** 案1：王道3ペイン */
function Layout1() {
  return (
    <div className="layout three-pane">
      <ThemeSidebar />
      <ChatPanel />
      <aside className="right-pane">
        <div className="sidebar-head">思考の樹形図</div>
        <NestedTree />
      </aside>
    </div>
  );
}

/** 案2：右ツリー強調型（現在地ハイライト＋パンくず常時） */
function Layout2() {
  return (
    <div className="layout three-pane right-heavy">
      <ThemeSidebar compact />
      <ChatPanel showBreadcrumb />
      <aside className="right-pane wide">
        <div className="sidebar-head">思考の樹形図（現在地を強調）</div>
        <NestedTree emphasize />
      </aside>
    </div>
  );
}

/** 案3：ラジアル（放射状）ツリー */
function Layout3() {
  return (
    <div className="layout three-pane">
      <ThemeSidebar />
      <ChatPanel />
      <aside className="right-pane">
        <div className="sidebar-head">思考の樹形図（放射状）</div>
        <RadialTree />
      </aside>
    </div>
  );
}

/** 案4：インデントツリー型 */
function Layout4() {
  return (
    <div className="layout three-pane">
      <ThemeSidebar />
      <ChatPanel />
      <aside className="right-pane">
        <div className="sidebar-head">思考の樹形図（インデント）</div>
        <IndentTree />
      </aside>
    </div>
  );
}

/** 案5：ミニマップ＋全画面ツリー切替 */
function Layout5() {
  const [full, setFull] = useState(false);
  return (
    <div className="layout two-pane">
      <ThemeSidebar />
      <div className="center-wrap">
        <ChatPanel />
        <div className="minimap">
          <div className="minimap-head">
            <span>樹形図</span>
            <button onClick={() => setFull(true)}>全画面 ⤢</button>
          </div>
          <div className="minimap-body">
            <NestedTree />
          </div>
        </div>
      </div>
      {full && (
        <div className="fullscreen-tree" onClick={() => setFull(false)}>
          <div className="ft-inner" onClick={(e) => e.stopPropagation()}>
            <div className="ft-head">
              <span>思考の樹形図（全画面）</span>
              <button onClick={() => setFull(false)}>閉じる ✕</button>
            </div>
            <RadialTree />
          </div>
        </div>
      )}
    </div>
  );
}

/** 案6：マインドマップ（採用候補）。左テーマ／右マップは開閉可、全画面化も可。 */
function Layout6() {
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [full, setFull] = useState(false);
  const cols =
    (leftOpen ? "220px" : "0px") + " 1fr " + (rightOpen ? "380px" : "0px");
  return (
    <div className="layout layout6" style={{ gridTemplateColumns: cols }}>
      <div className="collapsible left" style={{ display: leftOpen ? "block" : "none" }}>
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
        <ChatPanel showBreadcrumb />
      </div>
      <div className="collapsible right" style={{ display: rightOpen ? "block" : "none" }}>
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
            <div className="ft-canvas">
              <MindMap large />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const layouts: LayoutDef[] = [
  {
    id: "l1",
    label: "案1 王道3ペイン",
    note: "最も無難・学習コスト最小。左テーマ／中央チャット／右に縦型ツリー。",
    render: () => <Layout1 />,
  },
  {
    id: "l2",
    label: "案2 右ツリー強調",
    note: "右を広く・現在地を強調・パンくず常時。痛みB（気づけない）に全振り。",
    render: () => <Layout2 />,
  },
  {
    id: "l3",
    label: "案3 ラジアル",
    note: "中心＝テーマの放射状。俯瞰の地図感が強く映える。",
    render: () => <Layout3 />,
  },
  {
    id: "l4",
    label: "案4 インデント",
    note: "ファイルツリー風の折りたたみ。情報密度高く深い木に強い。",
    render: () => <Layout4 />,
  },
  {
    id: "l5",
    label: "案5 ミニマップ＋全画面",
    note: "普段はチャット＋小さなミニマップ、ボタンで全画面の樹形図に切替。",
    render: () => <Layout5 />,
  },
  {
    id: "l6",
    label: "案6 マインドマップ（採用候補）",
    note: "チャット主役。左テーマ／右マインドマップは開閉可、全画面化も可。中心テーマから枝が曲線で広がる。",
    render: () => <Layout6 />,
  },
];
