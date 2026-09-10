import { PrismaClient } from "@prisma/client";

// Em ambiente serverless, cada invocação pode recriar o módulo.
// Singleton global evita abrir conexão nova a cada request (limite do TiDB Cloud Serverless).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
