import { useState } from "react";
import { StoreProvider } from "./store";
import { layouts } from "./layouts";

export function App() {
  const [active, setActive] = useState(
    layouts.find((l) => l.id === "l6")?.id ?? layouts[0].id
  );
  const current = layouts.find((l) => l.id === active)!;

  return (
    <StoreProvider>
      <div className="app">
        <header className="topbar">
          <div className="brand">思考の樹形図 — モック比較</div>
          <div className="switcher">
            {layouts.map((l) => (
              <button
                key={l.id}
                className={l.id === active ? "tab active" : "tab"}
                onClick={() => setActive(l.id)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </header>
        <div className="note-bar">{current.note}</div>
        <main className="stage">{current.render()}</main>
      </div>
    </StoreProvider>
  );
}
