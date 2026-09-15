/**
 * Skeleton de carregamento para WorkCard.
 * Usar quando o conteúdo ainda não chegou (lazy load, filtro, paginação futura).
 */
export function WorkCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[3/2] w-full bg-surface" />
      <div className="mt-4 h-2.5 w-1/4 rounded-[1px] bg-surface" />
      <div className="mt-3 h-5 w-3/4 rounded-[1px] bg-surface" />
      <div className="mt-2 h-4 w-full rounded-[1px] bg-surface" />
      <div className="mt-1.5 h-4 w-2/3 rounded-[1px] bg-surface" />
    </div>
  );
}
