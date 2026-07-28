import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

function Loading() {
  return <div className="auth-loading">読み込み中…</div>;
}

/** Only lets an authenticated user through; guests go to the login screen. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === "loading") return <Loading />;
  if (status === "guest") return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** The mirror image: keeps a signed-in user out of the auth screens. */
export function RequireGuest({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === "loading") return <Loading />;
  if (status === "authenticated") return <Navigate to="/" replace />;
  return <>{children}</>;
}
