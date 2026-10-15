// Define uma senha nova para uma conta (ex.: a conta dona), rodando no seu computador.
// A senha é digitada por você, não aparece na tela e não fica salva em nenhum arquivo.
// Uso:  node scripts/definir-senha.mjs
import readline from "node:readline";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

// Carrega o .env (DATABASE_URL)
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => {
        if (s.includes(question)) rl.output.write(s);
        else rl.output.write("*");
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

const prisma = new PrismaClient();
try {
  const email = (await ask("E-mail da conta: ")).toLowerCase();
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) throw new Error("Não existe conta com esse e-mail.");
  const senha = await ask("Senha nova (mínimo 8 caracteres): ", true);
  if (senha.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
  const confirma = await ask("Repita a senha: ", true);
  if (senha !== confirma) throw new Error("As senhas não são iguais.");

  const hash = await hashPassword(senha);
  const conta = await prisma.account.findFirst({ where: { userId: user.id, providerId: "credential" } });
  if (conta) {
    await prisma.account.update({ where: { id: conta.id }, data: { password: hash, updatedAt: new Date() } });
  } else {
    await prisma.account.create({
      data: { id: crypto.randomUUID(), userId: user.id, accountId: user.id, providerId: "credential", password: hash, createdAt: new Date(), updatedAt: new Date() },
    });
  }
  // Encerra as sessões antigas dessa conta
  await prisma.session.deleteMany({ where: { userId: user.id } });
  console.log("Senha definida. Entre em gobeyondd.com.br/entrar com o e-mail e a senha nova.");
} catch (e) {
  console.error("Erro:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
