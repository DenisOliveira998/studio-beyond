// ---------------------------------------------------------------------------
// Better Auth — configuração do servidor (The Beyond)
// Provedores: Google OAuth + Email OTP (Resend)
// ---------------------------------------------------------------------------

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";
import { prisma } from "./prisma";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,

  database: prismaAdapter(prisma, { provider: "mysql" }),

  emailAndPassword: { enabled: false },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },

  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        await sendOTPEmail(email, otp, type);
      },
      expiresIn: 600, // 10 minutos
    }),
  ],

  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"),

  advanced: {
    disableCSRFCheck: true,
  },

  accountLinking: {
    enabled: true,
    trustedProviders: ["google"],
  },

  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
  ],

  // Ao criar usuário, cria Profile com papel padrão (reader).
  // Se o e-mail estiver em staff_emails, eleva para o papel correto.
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            const staffEntry = await prisma.staffEmail.findUnique({
              where: { email: user.email.toLowerCase() },
            });
            const role = staffEntry?.role ?? "reader";

            await prisma.profile.create({
              data: {
                id: user.id,
                name: user.name || user.email.split("@")[0],
                email: user.email,
                role,
              },
            });
          } catch (err) {
            console.error("[auth hook] Erro ao criar profile:", err);
          }
        },
      },
    },
  },
});

// ---------------------------------------------------------------------------
// Helper: envia e-mail com código OTP via Resend
// ---------------------------------------------------------------------------
async function sendOTPEmail(email: string, otp: string, type: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[sendOTPEmail] RESEND_API_KEY não configurada");
    return;
  }

  const isSignIn = type === "sign-in";
  const subject = isSignIn
    ? "Seu código de acesso — The Beyond"
    : "Confirme seu e-mail — The Beyond";

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:420px;margin:0 auto;padding:32px 24px;background:#121519;border-radius:4px">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#a08d24">The Beyond</p>
      <h1 style="margin:0 0 24px;font-size:22px;font-weight:700;color:#f6f6f6">
        ${isSignIn ? "Seu código de acesso" : "Confirme seu e-mail"}
      </h1>
      <p style="margin:0 0 16px;color:#9ba1ab;font-size:15px">
        Use o código abaixo para ${isSignIn ? "entrar na sua conta" : "confirmar seu cadastro"}:
      </p>
      <div style="background:#212529;border-radius:2px;padding:20px;text-align:center;margin:0 0 24px">
        <span style="font-size:44px;font-weight:800;letter-spacing:12px;color:#fdc600;font-variant-numeric:tabular-nums">${otp}</span>
      </div>
      <p style="margin:0;color:#4b4f58;font-size:13px">
        Válido por <strong style="color:#9ba1ab">10 minutos</strong>. Não compartilhe este código com ninguém.
      </p>
    </div>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "The Beyond <noreply@thebeyond.art>",
        to: email,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[sendOTPEmail] Resend erro:", res.status, body);
    }
  } catch (err) {
    console.error("[sendOTPEmail] Fetch error:", err);
  }
}
