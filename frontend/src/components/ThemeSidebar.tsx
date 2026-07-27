import { useStore } from "../store";

export function ThemeSidebar({ compact = false }: { compact?: boolean }) {
  const { trees, selectedTreeId, selectTree } = useStore();
  return (
    <aside className={"theme-sidebar" + (compact ? " compact" : "")}>
      <div className="sidebar-head">学習テーマ</div>
      <ul className="theme-list">
        {trees.map((t) => (
          <li
            key={t.id}
            className={t.id === selectedTreeId ? "active" : ""}
            onClick={() => selectTree(t.id)}
          >
            <span className="theme-dot" />
            {t.title}
          </li>
        ))}
      </ul>
      <button className="new-theme">＋ 新しいテーマ</button>
    </aside>
  );
}
