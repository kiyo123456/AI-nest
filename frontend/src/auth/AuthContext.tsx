import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, UnauthenticatedError } from "../api/client";
import type { ApiResource, User } from "../api/types";

/**
 * `loading` matters: without it the router would briefly treat a signed-in
 * user as a guest on first paint and flash the login screen before
 * `GET /api/me` resolves.
 */
type AuthStatus = "loading" | "authenticated" | "guest";

type RegisterInput = {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
};

type Auth = {
  status: AuthStatus;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);

  // Restore the session on load — the cookie survives a reload, the state doesn't.
  useEffect(() => {
    let cancelled = false;

    api
      .get<ApiResource<User>>("/api/me")
      .then(({ data }) => {
        if (cancelled) return;
        setUser(data);
        setStatus("authenticated");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (!(error instanceof UnauthenticatedError)) {
          console.error("Failed to restore the session", error);
        }
        setUser(null);
        setStatus("guest");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<Auth>(
    () => ({
      status,
      user,
      login: async (email, password) => {
        const { data } = await api.post<ApiResource<User>>("/api/login", {
          email,
          password,
        });
        setUser(data);
        setStatus("authenticated");
      },
      register: async (input) => {
        const { data } = await api.post<ApiResource<User>>(
          "/api/register",
          input,
        );
        setUser(data);
        setStatus("authenticated");
      },
      logout: async () => {
        await api.post<void>("/api/logout");
        setUser(null);
        setStatus("guest");
      },
    }),
    [status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
