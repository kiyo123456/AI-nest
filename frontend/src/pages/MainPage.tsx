import { useState } from "react";
import { Layout6 } from "../layouts";
import { StoreProvider } from "../store";
import { useAuth } from "../auth/AuthContext";

/**
 * The adopted layout (案6). Still driven by the in-memory prototype store —
 * wiring it to the real projects/nodes/messages API is the next slice.
 */
export function MainPage() {
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <StoreProvider>
      <div className="app">
        <header className="topbar">
          <div className="brand">思考の樹形図</div>
          <div className="spacer" />
          <span className="topbar-user">{user?.name}</span>
          <button
            className="topbar-logout"
            onClick={handleLogout}
            disabled={signingOut}
          >
            {signingOut ? "ログアウト中…" : "ログアウト"}
          </button>
        </header>
        <main className="stage">
          <Layout6 />
        </main>
      </div>
    </StoreProvider>
  );
}
