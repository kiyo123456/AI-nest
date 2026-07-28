import { useState, type FormEvent } from "react";
import { useProjects } from "../api/queries";
import { useCreateProject } from "../api/mutations";
import { useSelection } from "../selection/SelectionContext";

export function ThemeSidebar() {
  const { data: projects, isPending, isError } = useProjects();
  const { selectedProjectId, selectProject, selectNode } = useSelection();
  const createProject = useCreateProject();

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    const projectName = name.trim();
    if (!projectName || createProject.isPending) return;

    createProject.mutate(projectName, {
      onSuccess: ({ project, root }) => {
        setAdding(false);
        setName("");
        // Open the new theme at its root so it is ready to talk in.
        selectProject(project.id);
        selectNode(root.id);
      },
    });
  }

  return (
    <aside className="theme-sidebar">
      <div className="sidebar-head">学習テーマ</div>

      {isPending && <p className="pane-note">読み込み中…</p>}
      {isError && <p className="pane-note error">テーマを取得できませんでした。</p>}
      {projects?.length === 0 && (
        <p className="pane-note">まだ学習テーマがありません。</p>
      )}

      <ul className="theme-list">
        {projects?.map((project) => (
          <li
            key={project.id}
            className={project.id === selectedProjectId ? "active" : ""}
            onClick={() => selectProject(project.id)}
          >
            <span className="theme-dot" />
            {project.project_name}
          </li>
        ))}
      </ul>

      {adding ? (
        <form className="theme-form" onSubmit={handleCreate}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="何を学ぶ？"
            autoFocus
          />
          <div className="theme-form-actions">
            <button type="submit" disabled={createProject.isPending}>
              {createProject.isPending ? "作成中…" : "作成"}
            </button>
            <button type="button" onClick={() => setAdding(false)}>
              キャンセル
            </button>
          </div>
        </form>
      ) : (
        <button className="new-theme" onClick={() => setAdding(true)}>
          ＋ 新しいテーマ
        </button>
      )}

      {createProject.isError && (
        <p className="pane-note error">テーマを作成できませんでした。</p>
      )}
    </aside>
  );
}
