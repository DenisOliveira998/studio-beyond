import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import type { AuthSession } from "@/lib/auth-client";

export type AppRole = "owner" | "admin" | "gerente" | "author" | "vip" | "reader";

export const ROLE_LABEL: Record<AppRole, string> = {
  owner: "Dono",
  admin: "Administrador",
  gerente: "Gerente",
  author: "Autor",
  vip: "Leitor Assíduo",
  reader: "Leitor",
};

export type Profile = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  suspended: boolean;
};

type AuthValue = {
  loading: boolean;
  session: AuthSession | null;
  user: AuthSession["user"] | null;
  profile: Profile | null;
  role: AppRole;
  isOwner: boolean;
  isAdmin: boolean;
  isGerente: boolean;
  isStaff: boolean;
  isAuthor: boolean;
  isVip: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await authClient.getSession();
      setSession(data);

      if (data?.user?.id) {
        // Busca perfil via API interna do Better Auth
        const res = await fetch("/api/me");
        if (res.ok) {
          const p = (await res.json()) as Profile;
          setProfile(p);
        } else {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error("[auth] Erro ao carregar sessão:", err);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo<AuthValue>(() => {
    const role: AppRole = profile?.role ?? "reader";
    const isOwner = role === "owner";
    const isAdmin = role === "admin" || isOwner;
    const isGerente = role === "gerente";
    return {
      loading,
      session,
      user: session?.user ?? null,
      profile,
      role,
      isOwner,
      isAdmin,
      isGerente,
      isStaff: isOwner || isAdmin || isGerente,
      isAuthor: role === "author",
      isVip: role === "vip",
      refresh: load,
      signOut: async () => {
        await queryClient.cancelQueries();
        queryClient.clear();
        await authClient.signOut();
        setSession(null);
        setProfile(null);
      },
    };
  }, [loading, session, profile, load, queryClient]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return ctx;
}

export function highestRole(roles: AppRole[]): AppRole {
  const order: AppRole[] = ["owner", "admin", "gerente", "author", "vip", "reader"];
  return order.find((r) => roles.includes(r)) ?? "reader";
}
