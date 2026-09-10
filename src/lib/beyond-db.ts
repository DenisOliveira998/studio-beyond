import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/auth";
import type { Medium, Work } from "@/lib/beyond-data";

export type ReviewStatusDb = "pending" | "approved" | "rejected" | "changes" | "draft";

export type DbWork = {
  id: string;
  slug: string;
  title: string;
  medium: Medium;
  artist_name: string;
  artist_slug: string;
  author_id: string | null;
  excerpt: string;
  body: string;
  cover_url: string | null;
  tags: string | null;
  status: ReviewStatusDb;
  curator_note: string | null;
  created_at: string;
  published_at: string | null;
};

export type DbApplication = {
  id: string;
  user_id: string | null;
  artist_name: string;
  email: string;
  field: string;
  bio: string;
  portfolio: string;
  samples: number;
  message: string | null;
  status: ReviewStatusDb;
  curator_note: string | null;
  created_at: string;
  decided_at: string | null;
};

export type WorkStats = {
  views: Record<string, number>;
  donations: Record<string, number>;
  supporters: Record<string, number>;
};

const WORK_COLUMNS =
  "id, slug, title, medium, artist_name, artist_slug, author_id, excerpt, body, cover_url, tags, status, curator_note, created_at, published_at";

/* ---------- obras ---------- */

export async function fetchApprovedWorks(): Promise<DbWork[]> {
  const { data, error } = await supabase
    .from("works")
    .select(WORK_COLUMNS)
    .eq("status", "approved")
    .order("published_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbWork[];
}

export async function fetchWorkBySlug(slug: string): Promise<DbWork | null> {
  const { data, error } = await supabase
    .from("works")
    .select(WORK_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as DbWork | null) ?? null;
}

export async function fetchAllWorks(): Promise<DbWork[]> {
  const { data, error } = await supabase
    .from("works")
    .select(WORK_COLUMNS)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbWork[];
}

export async function fetchMyWorks(authorId: string): Promise<DbWork[]> {
  const { data, error } = await supabase
    .from("works")
    .select(WORK_COLUMNS)
    .eq("author_id", authorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbWork[];
}

export async function submitWork(input: {
  authorId: string;
  title: string;
  medium: Medium;
  artistName: string;
  excerpt: string;
  body: string;
  tags: string;
  status: "pending" | "draft";
}) {
  const base = slugify(input.title) || `obra-${Date.now()}`;
  const { error } = await supabase.from("works").insert({
    slug: `${base}-${Math.random().toString(36).slice(2, 6)}`,
    title: input.title,
    medium: input.medium,
    artist_name: input.artistName,
    artist_slug: slugify(input.artistName),
    author_id: input.authorId,
    excerpt: input.excerpt.slice(0, 240),
    body: input.body,
    tags: input.tags,
    status: input.status,
  });
  if (error) throw error;
}

export async function decideWork(id: string, status: "approved" | "rejected" | "changes", note?: string) {
  const { error } = await supabase.rpc("decide_work", {
    p_id: id,
    p_status: status,
    p_note: note ?? null,
  });
  if (error) throw error;
}

/* ---------- candidaturas ---------- */

export async function fetchApplications(): Promise<DbApplication[]> {
  const { data, error } = await supabase
    .from("author_applications")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbApplication[];
}

export async function createApplication(input: {
  userId: string | null;
  artistName: string;
  email: string;
  field: string;
  bio: string;
  portfolio: string;
  samples: number;
  message: string;
}) {
  const { error } = await supabase.from("author_applications").insert({
    user_id: input.userId,
    artist_name: input.artistName,
    email: input.email,
    field: input.field,
    bio: input.bio,
    portfolio: input.portfolio,
    samples: input.samples,
    message: input.message || null,
  });
  if (error) throw error;
}

export async function decideApplication(
  id: string,
  status: "approved" | "rejected" | "changes",
  note?: string,
) {
  const { error } = await supabase.rpc("decide_application", {
    p_id: id,
    p_status: status,
    p_note: note ?? null,
  });
  if (error) throw error;
}

/* ---------- contadores reais ---------- */

export async function fetchWorkStats(): Promise<WorkStats> {
  const [viewsRes, donationsRes] = await Promise.all([
    supabase.from("work_views").select("work_slug, views"),
    supabase.rpc("donation_totals"),
  ]);
  if (viewsRes.error) throw viewsRes.error;
  if (donationsRes.error) throw donationsRes.error;

  const views: Record<string, number> = {};
  for (const row of (viewsRes.data ?? []) as Array<{ work_slug: string; views: number }>) {
    views[row.work_slug] = Number(row.views);
  }
  const donations: Record<string, number> = {};
  const supporters: Record<string, number> = {};
  for (const row of (donationsRes.data ?? []) as Array<{
    work_slug: string;
    total: number;
    supporters: number;
  }>) {
    donations[row.work_slug] = Number(row.total);
    supporters[row.work_slug] = Number(row.supporters);
  }
  return { views, donations, supporters };
}

export async function registerWorkView(slug: string): Promise<number | null> {
  const { data, error } = await supabase.rpc("register_work_view", { p_slug: slug });
  if (error) return null;
  return data === null ? null : Number(data);
}

export type DonationRow = {
  id: string;
  work_slug: string;
  artist_slug: string;
  artist_name: string;
  donor_name: string;
  amount: number;
  created_at: string;
};

export async function fetchDonations(): Promise<DonationRow[]> {
  const { data, error } = await supabase
    .from("donations")
    .select("id, work_slug, artist_slug, artist_name, donor_name, amount, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as DonationRow[]).map((d) => ({ ...d, amount: Number(d.amount) }));
}

export async function createDonation(input: {
  workSlug: string;
  artistSlug: string;
  artistName: string;
  donorId: string | null;
  donorName: string;
  amount: number;
}) {
  const { error } = await supabase.from("donations").insert({
    work_slug: input.workSlug,
    artist_slug: input.artistSlug,
    artist_name: input.artistName,
    donor_id: input.donorId,
    donor_name: input.donorName || "Anônimo",
    amount: input.amount,
  });
  if (error) throw error;
}

/* ---------- contas ---------- */

export type AccountRow = {
  id: string;
  name: string;
  email: string;
  suspended: boolean;
  created_at: string;
  roles: AppRole[];
};

export async function fetchAccounts(): Promise<AccountRow[]> {
  const [profiles, roles] = await Promise.all([
    supabase.from("profiles").select("id, name, email, suspended, created_at").order("created_at"),
    supabase.from("user_roles").select("user_id, role"),
  ]);
  if (profiles.error) throw profiles.error;
  if (roles.error) throw roles.error;

  const byUser = new Map<string, AppRole[]>();
  for (const r of (roles.data ?? []) as Array<{ user_id: string; role: AppRole }>) {
    byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.role]);
  }
  return ((profiles.data ?? []) as Array<Omit<AccountRow, "roles">>).map((p) => ({
    ...p,
    roles: byUser.get(p.id) ?? [],
  }));
}

export async function setUserRole(userId: string, role: AppRole) {
  const { error } = await supabase.rpc("set_user_role", {
    p_user_id: userId,
    p_role: role,
    p_replace: true,
  });
  if (error) throw error;
}

export async function setSuspended(userId: string, suspended: boolean) {
  const { error } = await supabase.from("profiles").update({ suspended }).eq("id", userId);
  if (error) throw error;
}

/* ---------- utilidades ---------- */

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function dbWorkToWork(w: DbWork): Work {
  return {
    id: w.id,
    slug: w.slug,
    title: w.title,
    medium: w.medium,
    artistSlug: w.artist_slug,
    ...(w.cover_url ? { cover: w.cover_url } : {}),
    excerpt: w.excerpt,
    body: w.body ? w.body.split("\n").filter(Boolean) : [],
    clicks: 0,
    likes: 0,
    published: new Date(w.published_at ?? w.created_at).toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  };
}
