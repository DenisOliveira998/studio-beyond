/**
 * Adiciona coverUrl nas 40 obras de teste via picsum.photos
 * Execute: npx tsx scripts/add-test-covers.ts
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const envFile = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
try {
  for (const line of readFileSync(envFile, "utf-8").split("\n")) {
    const m = line.match(/^([^#=\s]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) process.env[m[1]] = m[2];
  }
} catch {}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeSlug(title: string, idx: number) {
  return `${slugify(title)}-${idx.toString(36)}`;
}

// Mesma ordem do seed script — fundamental para gerar slugs idênticos
const TITLES = [
  "O Último Arrebol",
  "A Cidade Sem Sombras",
  "Sertão Profundo",
  "Entre Dois Mares",
  "O Peso do Silêncio",
  "Flores de Novembro",
  "A Última Profecia",
  "Pele de Chuva",
  "Nenhum Passo Atrás",
  "O Jardim dos Esquecidos",
  "Sombra e Neon",
  "Horizonte Partido",
  "Dragão do Mangue",
  "Batidas do Asfalto",
  "O Mestre das Lâminas",
  "Fios de Prata",
  "Último Checkpoint",
  "Espelhos Partidos",
  "A Tribo dos Ventos",
  "Flores na Névoa",
  "Concreto",
  "A Última Fronteira",
  "Sangue e Tinta",
  "Diário de Uma Cidade",
  "Operação Fantasma",
  "A Fabulosa Máquina",
  "Olhos de Lobo",
  "Memórias da Orla",
  "Circuito Fechado",
  "Vozes da Periferia",
  "A Noite em que o Rio Parou",
  "Carta para Ninguém",
  "O Último Trem das Seis",
  "Três Perguntas para o Abismo",
  "Café com Memórias",
  "A Caça",
  "Quando a Maré Vira",
  "Equinócio",
  "O Dom dos Loucos",
  "Nós, os Restantes",
] as const;

async function main() {
  console.log(`🖼️  Adicionando capas para ${TITLES.length} obras...`);

  let updated = 0;
  let notFound = 0;

  for (let i = 0; i < TITLES.length; i++) {
    const slug = makeSlug(TITLES[i], i);
    const coverUrl = `https://picsum.photos/seed/beyond-${i}/600/900`;

    const result = await prisma.work.updateMany({
      where: { slug },
      data: { coverUrl },
    });

    if (result.count > 0) {
      console.log(`  ✓ [${i.toString().padStart(2, "0")}] ${TITLES[i]}`);
      updated++;
    } else {
      console.log(`  ✗ não encontrada: ${slug}`);
      notFound++;
    }
  }

  console.log(`\n✅ Concluído: ${updated} capas adicionadas, ${notFound} obras não encontradas.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
