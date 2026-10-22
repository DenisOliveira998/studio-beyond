import { Landmark } from "lucide-react";

/** No lugar do "Apoie" nas obras em domínio público: o que isso quer dizer e de onde veio o texto. */
export function PublicDomainCard({ source }: { source?: string | undefined }) {
  return (
    <section aria-label="Obra em domínio público" className="overflow-hidden rounded-xl bg-transparent">
      <div className="p-[18px]">
        <p className="flex items-center gap-2 text-[15px] font-bold text-foreground">
          <Landmark className="size-5 text-gilt" aria-hidden /> Domínio público
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Esta obra é de todos: o autor morreu há mais de 70 anos e o texto pode ser lido livremente. Por isso ela não recebe apoio.
        </p>
        {source && (
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Texto transcrito pelos voluntários do{" "}
            <a href={source} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-gilt">
              Wikisource
            </a>{" "}
            (
            <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.pt-br" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-gilt">
              CC BY-SA
            </a>
            ), com a grafia da edição original.
          </p>
        )}
      </div>
    </section>
  );
}
