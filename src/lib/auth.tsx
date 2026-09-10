import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "curator" | "author" | "vip" | "reader";

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrador",
  curator: "Curador",
  author: "Autor",
  vip: "Leitor Assíduo",
  reader: "Leitor",
};

export type Profile = {
  id: string;
  name: string;
  email: string;
  suspended: boolean;
};

type AuthValue = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  isAdmin: boolean;
  isCurator: boolean;
  isStaff: boolean;
  isAuthor: boolean;
  isVip: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const userId = session?.user?.id ?? null;

  const load = useCallback(async (id: string | null) => {
    if (!id) {
      setProfile(null);
      setRoles([]);
      return;
    }
    // Garante perfil e papel inicial (inclusive acesso de administrador/curador).
    await supabase.rpc("bootstrap_profile", { p_name: null });
    const [{ data: profileRow }, { data: roleRows }] = await Promise.all([
      supabase.from("profiles").select("id, name, email, suspended").eq("id", id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", id),
    ]);
    setProfile(profileRow ?? null);
    setRoles(((roleRows ?? []) as Array<{ role: AppRole }>).map((r) => r.role));
  }, []);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (
        event !== "SIGNED_IN" &&
        event !== "SIGNED_OUT" &&
        event !== "USER_UPDATED" &&
        event !== "INITIAL_SESSION"
      ) {
        return;
      }
      setSession(next);
    });
    void supabase.auth.getSession().then(({ data: got }) => {
      setSession(got.session);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void load(userId).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [userId, load]);

  const value = useMemo<AuthValue>(() => {
    const isAdmin = roles.includes("admin");
    const isCurator = roles.includes("curator");
    return {
      loading,
      session,
      user: session?.user ?? null,
      profile,
      roles,
      isAdmin,
      isCurator,
      isStaff: isAdmin || isCurator,
      isAuthor: roles.includes("author"),
      isVip: roles.includes("vip"),
      refresh: () => load(userId),
      signOut: async () => {
        await queryClient.cancelQueries();
        queryClient.clear();
        await supabase.auth.signOut();
        setProfile(null);
        setRoles([]);
      },
    };
  }, [loading, session, profile, roles, load, userId, queryClient]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return ctx;
}

export function highestRole(roles: AppRole[]): AppRole {
  const order: AppRole[] = ["admin", "curator", "author", "vip", "reader"];
  return order.find((r) => roles.includes(r)) ?? "reader";
}
