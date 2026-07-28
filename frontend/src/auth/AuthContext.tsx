import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  api,
  setUnauthenticatedHandler,
  UnauthenticatedError,
} from "../api/client";
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
  /** True when the session ended on its own rather than by signing out. */
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const queryClient = useQueryClient();

  // Read inside the 401 handler, which is registered once and would otherwise
  // close over the status from its first render.
  const statusRef = useRef<AuthStatus>(status);
  statusRef.current = status;

  /*
   * React to a 401 arriving on any request.
   *
   * The guard matters: `GET /api/me` answers 401 for every first-time
   * visitor, so reacting unconditionally would greet them with "your session
   * expired". Only a session we believed was live can expire.
   */
  useEffect(() => {
    setUnauthenticatedHandler(() => {
      if (statusRef.current !== "authenticated") return;
      queryClient.clear();
      setUser(null);
      setSessionExpired(true);
      // `RequireAuth` sends them to /login from here — no routing needed.
      setStatus("guest");
    });

    return () => setUnauthenticatedHandler(null);
  }, [queryClient]);

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
      sessionExpired,
      login: async (email, password) => {
        const { data } = await api.post<ApiResource<User>>("/api/login", {
          email,
          password,
        });
        // Whoever was signed in before must not leak through the cache.
        queryClient.clear();
        setSessionExpired(false);
        setUser(data);
        setStatus("authenticated");
      },
      register: async (input) => {
        const { data } = await api.post<ApiResource<User>>(
          "/api/register",
          input,
        );
        queryClient.clear();
        setSessionExpired(false);
        setUser(data);
        setStatus("authenticated");
      },
      logout: async () => {
        await api.post<void>("/api/logout");
        queryClient.clear();
        setSessionExpired(false);
        setUser(null);
        setStatus("guest");
      },
    }),
    [status, user, sessionExpired, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
