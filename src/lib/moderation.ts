// Denúncias e moderação: criar denúncia, listar para a equipe e aplicar ações.
import { prisma } from "@/lib/prisma";
import { stripHtml } from "@/lib/utils";

export const REPORT_REASONS = [
  "Spam ou propaganda",
  "Assédio ou discurso de ódio",
  "Golpe ou fraude",
  "Conteúdo sexual ou impróprio para menores",
  "Plágio ou violação de direitos autorais",
  "Outro",
];

/** Comentário com esse número de denúncias abertas fica oculto até a equipe analisar. */
export const AUTO_HIDE_THRESHOLD = 3;

type TargetType = "comment" | "work" | "author";

export async function createReport(input: {
  reporterId: string;
  targetType: TargetType;
  targetId: string;
  reason: string;
  details: string;
}): Promise<{ ok: boolean; created: boolean }> {
  // O alvo precisa existir
  if (input.targetType === "comment") {
    const c = await prisma.workComment.findUnique({ where: { id: input.targetId }, select: { id: true } });
    if (!c) return { ok: false, created: false };
  } else if (input.targetType === "work") {
    const w = await prisma.work.findFirst({ where: { slug: input.targetId, status: "approved" }, select: { id: true } });
    if (!w) return { ok: false, created: false };
  } else {
    const a = await prisma.work.findFirst({ where: { artistSlug: input.targetId, status: "approved" }, select: { id: true } });
    if (!a) return { ok: false, created: false };
  }

  // Uma denúncia por pessoa por alvo (repetir não conta duas vezes)
  const existing = await prisma.report.findUnique({
    where: { reporterId_targetType_targetId: { reporterId: input.reporterId, targetType: input.targetType, targetId: input.targetId } },
  });
  if (existing) return { ok: true, created: false };
  await prisma.report.create({ data: { ...input } });

  // Comentário muito denunciado some até a análise
  if (input.targetType === "comment") {
    const open = await prisma.report.count({ where: { targetType: "comment", targetId: input.targetId, status: "open" } });
    if (open >= AUTO_HIDE_THRESHOLD) {
      await prisma.workComment.update({ where: { id: input.targetId }, data: { hidden: true } }).catch(() => {});
    }
  }
  return { ok: true, created: true };
}

export type ReportRow = {
  id: string;
  targetType: TargetType;
  targetId: string;
  reason: string;
  details: string;
  status: string;
  createdAt: string;
  reporterName: string;
  /** Total de denúncias abertas sobre o mesmo alvo */
  openCount: number;
  target: {
    label: string;
    link: string | null;
    excerpt: string;
    hidden?: boolean | undefined;
    /** Conta responsável pelo conteúdo (para suspender) */
    ownerId: string | null;
    ownerName: string;
    ownerSuspended?: boolean | undefined;
  };
};

export async function fetchReports(status: string | null): Promise<ReportRow[]> {
  const rows = await prisma.report.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  if (!rows.length) return [];

  const reporterIds = [...new Set(rows.map((r) => r.reporterId))];
  const commentIds = rows.filter((r) => r.targetType === "comment").map((r) => r.targetId);
  const workSlugs = rows.filter((r) => r.targetType === "work").map((r) => r.targetId);
  const authorSlugs = rows.filter((r) => r.targetType === "author").map((r) => r.targetId);

  const [reporters, comments, works, authorWorks, openGroups] = await Promise.all([
    prisma.profile.findMany({ where: { id: { in: reporterIds } }, select: { id: true, name: true } }),
    commentIds.length ? prisma.workComment.findMany({ where: { id: { in: commentIds } } }) : [],
    workSlugs.length ? prisma.work.findMany({ where: { slug: { in: workSlugs } }, select: { slug: true, title: true, artistName: true, authorId: true, status: true } }) : [],
    authorSlugs.length ? prisma.work.findMany({ where: { artistSlug: { in: authorSlugs } }, select: { artistSlug: true, artistName: true, authorId: true } }) : [],
    prisma.report.groupBy({ by: ["targetType", "targetId"], where: { status: "open" }, _count: { id: true } }),
  ]);
  const ownerIds = [
    ...comments.map((c) => c.userId),
    ...works.map((w) => w.authorId),
    ...authorWorks.map((w) => w.authorId),
  ].filter(Boolean) as string[];
  const owners = ownerIds.length
    ? await prisma.profile.findMany({ where: { id: { in: [...new Set(ownerIds)] } }, select: { id: true, name: true, suspended: true } })
    : [];

  const reporterName = new Map(reporters.map((p) => [p.id, p.name]));
  const commentById = new Map(comments.map((c) => [c.id, c]));
  const workBySlug = new Map(works.map((w) => [w.slug, w]));
  const authorBySlug = new Map(authorWorks.map((w) => [w.artistSlug, w]));
  const ownerById = new Map(owners.map((o) => [o.id, o]));
  const openCount = new Map(openGroups.map((g) => [`${g.targetType}:${g.targetId}`, g._count.id]));

  return rows.map((r) => {
    let target: ReportRow["target"];
    if (r.targetType === "comment") {
      const c = commentById.get(r.targetId);
      const owner = c?.userId ? ownerById.get(c.userId) : undefined;
      target = c
        ? { label: `Comentário de ${c.author}`, link: `/obra/${c.workSlug}`, excerpt: c.text.slice(0, 300), hidden: c.hidden, ownerId: c.userId, ownerName: c.author, ownerSuspended: owner?.suspended }
        : { label: "Comentário removido", link: null, excerpt: "", ownerId: null, ownerName: "" };
    } else if (r.targetType === "work") {
      const w = workBySlug.get(r.targetId);
      const owner = w?.authorId ? ownerById.get(w.authorId) : undefined;
      target = w
        ? { label: `Obra: ${stripHtml(w.title)}${w.status !== "approved" ? " (despublicada)" : ""}`, link: `/obra/${r.targetId}`, excerpt: `de ${w.artistName}`, ownerId: w.authorId, ownerName: w.artistName, ownerSuspended: owner?.suspended }
        : { label: "Obra não encontrada", link: null, excerpt: "", ownerId: null, ownerName: "" };
    } else {
      const a = authorBySlug.get(r.targetId);
      const owner = a?.authorId ? ownerById.get(a.authorId) : undefined;
      target = a
        ? { label: `Autor: ${a.artistName}`, link: `/autor/${r.targetId}`, excerpt: "", ownerId: a.authorId, ownerName: a.artistName, ownerSuspended: owner?.suspended }
        : { label: "Autor não encontrado", link: null, excerpt: "", ownerId: null, ownerName: "" };
    }
    return {
      id: r.id,
      targetType: r.targetType as TargetType,
      targetId: r.targetId,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      reporterName: reporterName.get(r.reporterId) ?? "—",
      openCount: openCount.get(`${r.targetType}:${r.targetId}`) ?? 0,
      target,
    };
  });
}

/** Fecha todas as denúncias abertas sobre o mesmo alvo. */
async function closeTargetReports(targetType: string, targetId: string, status: "resolved" | "dismissed", actorId: string) {
  await prisma.report.updateMany({
    where: { targetType, targetId, status: "open" },
    data: { status, resolvedBy: actorId, resolvedAt: new Date() },
  });
}

/**
 * Ações da equipe:
 * - dismiss: descarta (e, se for comentário oculto automaticamente, volta a mostrar)
 * - hide_comment / restore_comment / remove_comment
 * - unpublish_work: tira a obra do ar (volta para "ajustes solicitados")
 * - suspend_owner: suspende a conta responsável pelo conteúdo
 */
export async function applyReportAction(
  reportId: string,
  action: string,
  actorId: string,
  actorEmail: string,
): Promise<{ ok: boolean; error?: string }> {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) return { ok: false, error: "Denúncia não encontrada." };
  const { targetType, targetId } = report;

  switch (action) {
    case "dismiss":
      await closeTargetReports(targetType, targetId, "dismissed", actorId);
      if (targetType === "comment") {
        await prisma.workComment.update({ where: { id: targetId }, data: { hidden: false } }).catch(() => {});
      }
      return { ok: true };
    case "hide_comment":
      if (targetType !== "comment") return { ok: false, error: "Ação só vale para comentários." };
      await prisma.workComment.update({ where: { id: targetId }, data: { hidden: true } });
      await closeTargetReports(targetType, targetId, "resolved", actorId);
      return { ok: true };
    case "restore_comment":
      if (targetType !== "comment") return { ok: false, error: "Ação só vale para comentários." };
      await prisma.workComment.update({ where: { id: targetId }, data: { hidden: false } });
      return { ok: true };
    case "remove_comment":
      if (targetType !== "comment") return { ok: false, error: "Ação só vale para comentários." };
      await prisma.workComment.delete({ where: { id: targetId } }).catch(() => {});
      await closeTargetReports(targetType, targetId, "resolved", actorId);
      return { ok: true };
    case "unpublish_work": {
      if (targetType !== "work") return { ok: false, error: "Ação só vale para obras." };
      const work = await prisma.work.findUnique({ where: { slug: targetId }, select: { slug: true, title: true } });
      if (!work) return { ok: false, error: "Obra não encontrada." };
      await prisma.work.update({
        where: { slug: targetId },
        data: { status: "changes", curatorNote: `Despublicada pela moderação após denúncia: ${report.reason}.` },
      });
      await prisma.auditLog
        .create({ data: { action: "work_status_changed", workSlug: work.slug, workTitle: work.title, actorId, actorEmail, note: `Despublicada por denúncia (${report.reason})` } })
        .catch(() => {});
      await closeTargetReports(targetType, targetId, "resolved", actorId);
      return { ok: true };
    }
    case "suspend_owner": {
      let ownerId: string | null = null;
      if (targetType === "comment") {
        ownerId = (await prisma.workComment.findUnique({ where: { id: targetId }, select: { userId: true } }))?.userId ?? null;
      } else if (targetType === "work") {
        ownerId = (await prisma.work.findUnique({ where: { slug: targetId }, select: { authorId: true } }))?.authorId ?? null;
      } else {
        ownerId = (await prisma.work.findFirst({ where: { artistSlug: targetId, authorId: { not: null } }, select: { authorId: true } }))?.authorId ?? null;
      }
      if (!ownerId) return { ok: false, error: "Não há conta ligada a esse conteúdo." };
      const owner = await prisma.profile.findUnique({ where: { id: ownerId }, select: { role: true } });
      if (owner && ["owner", "admin"].includes(owner.role)) return { ok: false, error: "Contas de dono/admin não são suspensas por aqui." };
      await prisma.profile.update({ where: { id: ownerId }, data: { suspended: true } });
      await closeTargetReports(targetType, targetId, "resolved", actorId);
      return { ok: true };
    }
    default:
      return { ok: false, error: "Ação desconhecida." };
  }
}
